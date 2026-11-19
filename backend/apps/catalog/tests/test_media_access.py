"""Protection des pleines résolutions des galeries payantes, miniatures, URL relatives."""
import io
import shutil
import tempfile
from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.accounts.tests.helpers import BaseTestCase, image_file, make_artist
from apps.catalog import services
from apps.catalog.media import is_public_media
from apps.catalog.models import Artwork, ArtworkStatus, Gallery
from apps.catalog.tests.test_catalog import URL, artwork_data
from apps.payments.models import VisitPass

MEDIA = tempfile.mkdtemp(prefix="agapy-catalog-media-")


def publish(artwork):
    Artwork.objects.filter(pk=artwork.pk).update(status=ArtworkStatus.PENDING_REVIEW)
    artwork.refresh_from_db()
    services.approve_artwork(artwork)
    return artwork


def visit_pass(artist, token, hours=24):
    return VisitPass.objects.create(token=token, artist=artist, expires_at=timezone.now() + timedelta(hours=hours))


@override_settings(MEDIA_ROOT=MEDIA, DEBUG=False)
class MediaAccessTests(BaseTestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.artist = self.user.artist
        self.client.force_authenticate(self.user)
        r = self.client.post(f"{URL}me/artworks/", artwork_data(image=image_file("grande.png", (1200, 800))),
                             format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.mine = r.data
        self.artwork = publish(Artwork.objects.get(slug=r.data["id"]))
        Gallery.for_artist(self.artist)  # galerie payante par défaut
        self.client.force_authenticate(None)
        self.image_url = f"{URL}artworks/{self.artwork.slug}/image/"

    # --- Miniature et stockage ---------------------------------------------------
    def test_thumbnail_generated_and_storage_names(self):
        a = self.artwork
        self.assertRegex(a.image.name, rf"^artworks/{self.artist.slug}/[0-9a-f]{{32}}\.png$")
        self.assertRegex(a.thumbnail.name, rf"^artworks/{self.artist.slug}/thumbs/[0-9a-f]{{32}}\.webp$")
        with Image.open(a.thumbnail.path) as img:
            self.assertEqual((img.format, img.size), ("WEBP", (480, 320)))
        # Nouvelle image → nouvelle miniature, l'ancienne est supprimée
        old = a.thumbnail.name
        a.image.save("autre.png", image_file("autre.png", (100, 300)), save=False)
        a.save()
        a.refresh_from_db()
        self.assertNotEqual(a.thumbnail.name, old)
        self.assertFalse(a.thumbnail.storage.exists(old))

    def test_build_thumbnails_command_idempotent(self):
        Artwork.objects.filter(pk=self.artwork.pk).update(thumbnail="")
        out = StringIO()
        call_command("build_thumbnails", stdout=out)
        self.assertIn("1 miniature(s) générée(s)", out.getvalue())
        self.assertTrue(Artwork.objects.get(pk=self.artwork.pk).thumbnail)
        out = StringIO()
        call_command("build_thumbnails", stdout=out)
        self.assertIn("0 miniature(s) générée(s), 1 déjà présente(s)", out.getvalue())

    # --- Galerie payante ---------------------------------------------------------------
    def test_paid_gallery_without_token_is_locked(self):
        for url in (f"{URL}artworks/{self.artwork.slug}/", f"{URL}artists/{self.artist.slug}/"):
            data = self.client.get(url).data
            work = data["artworks"][0] if "artworks" in data else data
            self.assertIsNone(work["image"])
            self.assertTrue(work["locked"])
            self.assertTrue(work["thumbnail"].startswith("/media/artworks/"))
        listed = self.client.get(f"{URL}artworks/").data["results"][0]
        self.assertEqual((listed["image"], listed["locked"]), (None, True))
        found = self.client.get(f"{URL}search/", {"q": "awa"}).data
        self.assertIsNone(found["artworks"][0]["image"])
        self.assertTrue(found["artists"][0]["cover"].startswith("/media/artworks/"))
        self.assertIn("/thumbs/", found["artists"][0]["cover"])

        r = self.client.get(self.image_url)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["codes"]["detail"], "visit_required")

    def test_valid_visit_token(self):
        visit_pass(self.artist, "jeton-valide")
        work = self.client.get(f"{URL}artworks/{self.artwork.slug}/", HTTP_X_VISIT_TOKEN="jeton-valide").data
        self.assertFalse(work["locked"])
        self.assertEqual(work["image"], f"{self.image_url}?visit_token=jeton-valide")  # URL relative
        r = self.client.get(work["image"])  # comme une balise <img> : jeton en paramètre
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "image/png")
        self.assertIn("private", r["Cache-Control"])
        b"".join(r.streaming_content)  # lit le fichier (fermer la réponse à la main ferme la connexion MySQL du test)
        r = self.client.get(self.image_url, HTTP_X_VISIT_TOKEN="jeton-valide")
        self.assertEqual(r.status_code, 200)
        b"".join(r.streaming_content)  # lit le fichier (fermer la réponse à la main ferme la connexion MySQL du test)

    def test_token_of_other_artist_or_expired(self):
        other = make_artist(phone="+2250700000009").artist
        visit_pass(other, "jeton-autre")
        visit_pass(self.artist, "jeton-expire", hours=-1)
        for token in ("jeton-autre", "jeton-expire"):
            r = self.client.get(self.image_url, HTTP_X_VISIT_TOKEN=token)
            self.assertEqual(r.status_code, 403)
            self.assertEqual(r.data["codes"]["detail"], "visit_token_invalid")
            work = self.client.get(f"{URL}artworks/{self.artwork.slug}/", HTTP_X_VISIT_TOKEN=token).data
            self.assertIsNone(work["image"])

    def test_free_gallery(self):
        Gallery.objects.filter(artist=self.artist).update(is_free=True)
        work = self.client.get(f"{URL}artworks/{self.artwork.slug}/").data
        self.assertEqual((work["image"], work["locked"]), (self.image_url, False))
        r = self.client.get(self.image_url)
        self.assertEqual(r.status_code, 200)
        b"".join(r.streaming_content)  # lit le fichier (fermer la réponse à la main ferme la connexion MySQL du test)
        Gallery.objects.filter(artist=self.artist).update(free_until=timezone.localdate() - timedelta(days=1))
        self.assertEqual(self.client.get(self.image_url).status_code, 403)

    def test_owner_and_staff(self):
        self.client.force_authenticate(self.user)
        work = self.client.get(f"{URL}artworks/{self.artwork.slug}/").data
        self.assertFalse(work["locked"])
        self.assertIn("?sig=", work["image"])
        r = self.client.get(self.image_url)
        self.assertEqual(r.status_code, 200)
        b"".join(r.streaming_content)  # lit le fichier (fermer la réponse à la main ferme la connexion MySQL du test)
        # URL signée de l'espace artiste : utilisable sans en-tête (balise <img>)
        mine = self.client.get(f"{URL}me/artworks/{self.artwork.slug}/").data
        self.assertTrue(mine["image"].startswith(f"{self.image_url}?sig="))
        self.client.force_authenticate(None)
        r = self.client.get(mine["image"])
        self.assertEqual(r.status_code, 200)
        b"".join(r.streaming_content)  # lit le fichier (fermer la réponse à la main ferme la connexion MySQL du test)
        self.assertEqual(self.client.get(f"{self.image_url}?sig=faux").status_code, 403)
        staff = User.objects.create_user(phone="+2250700000077", password="x", is_staff=True)
        self.client.force_authenticate(staff)
        r = self.client.get(self.image_url)
        self.assertEqual(r.status_code, 200)
        b"".join(r.streaming_content)  # lit le fichier (fermer la réponse à la main ferme la connexion MySQL du test)
        # Une signature pour l'image n'ouvre pas l'extrait
        self.client.force_authenticate(None)
        sig = mine["image"].split("sig=")[1]
        self.assertEqual(self.client.get(f"{URL}artworks/{self.artwork.slug}/excerpt/?sig={sig}").status_code, 404)

    def test_excerpt_protected(self):
        self.artwork.excerpt.save("e.mp3", io.BytesIO(b"ID3\x04\x00" + b"0" * 64), save=False)
        self.artwork.excerpt_duration = 20
        self.artwork.save()
        url = f"{URL}artworks/{self.artwork.slug}/excerpt/"
        self.assertIsNone(self.client.get(f"{URL}artworks/{self.artwork.slug}/").data["excerpt"])
        self.assertEqual(self.client.get(url).data["codes"]["detail"], "visit_required")
        visit_pass(self.artist, "jeton-valide")
        work = self.client.get(f"{URL}artworks/{self.artwork.slug}/", HTTP_X_VISIT_TOKEN="jeton-valide").data
        self.assertEqual(work["excerpt"], f"{url}?visit_token=jeton-valide")
        r = self.client.get(work["excerpt"])
        self.assertEqual((r.status_code, r["Content-Type"]), (200, "audio/mpeg"))
        b"".join(r.streaming_content)  # lit le fichier (fermer la réponse à la main ferme la connexion MySQL du test)

    def test_unpublished_artwork_file_not_found(self):
        Artwork.objects.filter(pk=self.artwork.pk).update(status=ArtworkStatus.DRAFT)
        Gallery.objects.filter(artist=self.artist).update(is_free=True)
        self.assertEqual(self.client.get(self.image_url).status_code, 404)

    # --- URL relatives ---------------------------------------------------------------
    def test_relative_urls_and_pagination(self):
        Gallery.objects.filter(artist=self.artist).update(is_free=True)
        self.client.force_authenticate(self.user)
        for title in ("Deux", "Trois"):
            r = self.client.post(f"{URL}me/artworks/", artwork_data(title=title), format="multipart")
            publish(Artwork.objects.get(slug=r.data["id"]))
        self.client.force_authenticate(None)
        r = self.client.get(f"{URL}artworks/", {"page_size": 1, "discipline": "peinture"})
        self.assertTrue(r.data["next"].startswith(f"{URL}artworks/?"))
        self.assertIn("page=2", r.data["next"])
        self.assertIn("discipline=peinture", r.data["next"])
        r2 = self.client.get(r.data["next"])
        self.assertTrue(r2.data["previous"].startswith(f"{URL}artworks/?"))
        self.assertNotIn("page=", r2.data["previous"])
        work = r.data["results"][0]
        for key in ("image", "thumbnail"):
            self.assertTrue(work[key].startswith("/"), work[key])
            self.assertNotIn("http", work[key])
        artist = self.client.get(f"{URL}artists/").data["results"][0]
        self.assertTrue(artist["cover"].startswith("/media/"))
        self.assertIsNone(artist["photo"])

    # --- Dette : approbation -----------------------------------------------------------
    def test_approve_requires_pending_review(self):
        draft = Artwork.objects.create(
            artist=self.artist, title="Brouillon", summary="-", technique="-", height_cm=1, width_cm=1,
            copyright_office="BURIDA", image=image_file())
        with self.assertRaises(ValidationError) as ctx:
            services.approve_artwork(draft)
        self.assertEqual(ctx.exception.get_codes(), {"detail": "not_pending_review"})
        draft.refresh_from_db()
        self.assertEqual(draft.status, ArtworkStatus.DRAFT)


class PublicMediaPathTests(BaseTestCase):
    def test_debug_media_filter(self):
        self.assertTrue(is_public_media("artworks/awa/thumbs/abc.webp"))
        self.assertTrue(is_public_media("artists/awa/photo.jpg"))
        self.assertTrue(is_public_media("ads/2026/11/x.png"))
        for path in ("artworks/awa/abc.png", "artworks/awa/extrait-1.mp3", "Artworks/awa/abc.png",
                     "artworks/awa/thumbs/../abc.png", "x/../artworks/awa/abc.png", "artworks\\awa\\abc.png",
                     "/artworks/awa/abc.png", "artworks/awa/thumbs/sub/abc.png"):
            self.assertFalse(is_public_media(path), path)
