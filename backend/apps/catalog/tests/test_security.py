"""Fichiers téléversés, contournements de la modération, compteurs, visites des artistes."""
import io
import shutil
import tempfile
from datetime import timedelta
from unittest import mock

from django.contrib.admin.sites import site
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image

from apps.accounts.tests.helpers import BaseTestCase, make_artist
from apps.catalog import services
from apps.catalog.admin import ArtworkAdmin
from apps.catalog.models import Artwork, ArtworkStatus, Gallery
from apps.catalog.tests.test_catalog import URL, artwork_data
from apps.payments.models import Payment, VisitLog

MEDIA = tempfile.mkdtemp(prefix="agapy-catalog-sec-")


def jpeg_with_exif(name="photo.jpg"):
    exif = Image.Exif()
    exif[0x010F] = "Appareil"  # Make
    buf = io.BytesIO()
    Image.new("RGB", (12, 12), "red").save(buf, "JPEG", exif=exif.tobytes())
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=MEDIA, PAYMENT_SIMULATION_ENABLED=True,
                   PAYMENT_PROVIDERS={"card": "apps.payments.providers.fake.FakeProvider",
                                      "momo": "apps.payments.providers.fake.FakeProvider"})
class CatalogSecurityTests(BaseTestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.artist = self.user.artist
        self.client.force_authenticate(self.user)

    def post(self, **extra):
        return self.client.post(f"{URL}me/artworks/", artwork_data(**extra), format="multipart")

    def create(self, **extra):
        r = self.post(**extra)
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def published(self, **extra):
        artwork = Artwork.objects.get(slug=self.create(**extra)["id"])
        Artwork.objects.filter(pk=artwork.pk).update(status=ArtworkStatus.PENDING_REVIEW)
        artwork.refresh_from_db()
        services.approve_artwork(artwork)
        return artwork

    # --- M6 : fichiers ----------------------------------------------------------
    def test_image_type_checked_and_reencoded(self):
        buf = io.BytesIO()
        Image.new("RGB", (4, 4)).save(buf, "GIF")
        r = self.post(image=SimpleUploadedFile("x.png", buf.getvalue(), content_type="image/png"))
        self.assertEqual(r.data["codes"]["image"], ["file_type"])  # GIF sous une extension .png
        a = self.create(image=jpeg_with_exif("photo.png"))  # JPEG sous une extension .png
        artwork = Artwork.objects.get(slug=a["id"])
        self.assertTrue(artwork.image.name.endswith(".jpg"))
        with Image.open(artwork.image.path) as img:
            self.assertEqual(len(img.getexif()), 0)  # métadonnées supprimées

    def test_image_limits(self):
        with mock.patch("apps.core.uploads.MAX_IMAGE_SIDE", 5):
            self.assertEqual(self.post().data["codes"]["image"], ["image_too_large"])
        with mock.patch("apps.catalog.serializers.ARTWORK_IMAGE_MAX_BYTES", 10):
            self.assertEqual(self.post().data["codes"]["image"], ["file_too_large"])

    def test_excerpt_signature(self):
        fake = SimpleUploadedFile("extrait.mp3", b"<html>pas un son</html>", content_type="audio/mpeg")
        r = self.post(excerpt=fake, excerpt_duration="20")
        self.assertEqual(r.data["codes"]["excerpt"], ["file_type"])
        r = self.post(excerpt=SimpleUploadedFile("extrait.exe", b"ID3" + b"0" * 64), excerpt_duration="20")
        self.assertEqual(r.data["codes"]["excerpt"], ["file_type"])
        ok = SimpleUploadedFile("extrait.mp3", b"ID3\x04\x00" + b"0" * 64, content_type="audio/mpeg")
        self.assertEqual(self.post(excerpt=ok, excerpt_duration="20").status_code, 201)

    def test_is_free_read_only(self):
        self.assertFalse(self.create(is_free="true")["is_free"])

    # --- M4 / L7 -------------------------------------------------------------------
    def test_red_listed_cannot_edit_published_title(self):
        artwork = self.published()
        self.artist.red_listed_until = timezone.localdate() + timedelta(days=10)
        self.artist.save()
        r = self.client.patch(f"{URL}me/artworks/{artwork.slug}/", {"title": "Autre"}, format="multipart")
        self.assertEqual((r.status_code, r.data["codes"]["detail"]), (403, "red_listed"))
        artwork.refresh_from_db()
        self.assertEqual((artwork.title, artwork.status), ("Lagune au matin", ArtworkStatus.PUBLISHED))
        r = self.client.patch(f"{URL}me/artworks/{artwork.slug}/", {"summary": "Autre résumé"}, format="multipart")
        self.assertEqual(r.status_code, 200)  # les autres champs restent modifiables

    def test_resubmit_reuses_pending_payment(self):
        Gallery.for_artist(self.artist)
        Gallery.objects.filter(artist=self.artist).update(free_publication_used=True)
        url = f"{URL}me/artworks/{self.create()['id']}/submit/"
        first = self.client.post(url, {"method": "momo"}, format="json").data["payment"]["reference"]
        second = self.client.post(url, {"method": "momo"}, format="json").data["payment"]["reference"]
        self.assertEqual(first, second)
        third = self.client.post(url, {"method": "card"}, format="json").data["payment"]["reference"]
        self.assertNotEqual(third, first)
        self.assertEqual(Payment.objects.get(reference=first).status, "cancelled")
        self.assertEqual(Payment.objects.filter(status="pending").count(), 1)

    def test_admin_approve_only_pending_review(self):
        draft = Artwork.objects.get(slug=self.create()["id"])
        admin = ArtworkAdmin(Artwork, site)
        with mock.patch.object(admin, "message_user"):
            admin.approve(None, Artwork.objects.filter(pk=draft.pk))
        draft.refresh_from_db()
        self.assertEqual(draft.status, ArtworkStatus.DRAFT)

    # --- H3 / conformité ---------------------------------------------------------------
    def test_view_counted_once_per_ip(self):
        artwork = self.published()
        self.client.force_authenticate(None)
        for _ in range(3):
            r = self.client.get(f"{URL}artworks/{artwork.slug}/")
        self.assertEqual(r.data["view_count"], 1)
        r = self.client.get(f"{URL}artworks/{artwork.slug}/", REMOTE_ADDR="10.0.0.2")
        self.assertEqual(r.data["view_count"], 2)

    def test_artist_visits_ordering_and_free_gallery(self):
        self.published()
        other = make_artist(phone="+2250700000009").artist
        Artwork.objects.filter(artist=self.artist).update(view_count=50)
        for _ in range(3):
            VisitLog.objects.create(artist=other, free=True)
        self.client.force_authenticate(None)
        r = self.client.get(f"{URL}artists/", {"ordering": "-visits"})
        self.assertEqual([(x["id"], x["visits"]) for x in r.data["results"]],
                         [(other.slug, 3), (self.artist.slug, 0)])
        r = self.client.get(f"{URL}artists/", {"ordering": "-views"})
        self.assertEqual(r.data["results"][0]["id"], self.artist.slug)
        self.assertEqual(self.client.get(f"{URL}artists/{other.slug}/").data["visits"], 3)

        self.assertEqual(self.client.get(f"{URL}artworks/", {"free_gallery": "true"}).data["count"], 0)
        Gallery.objects.filter(artist=self.artist).update(is_free=True)
        self.assertEqual(self.client.get(f"{URL}artworks/", {"free_gallery": "true"}).data["count"], 1)
