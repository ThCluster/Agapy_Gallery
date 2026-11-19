import shutil
import tempfile
from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

from apps.accounts.models import ArtistStatus
from apps.accounts.tests.helpers import BaseTestCase, image_file, make_artist
from apps.catalog import services
from apps.catalog.models import Artwork, ArtworkStatus, Gallery
from apps.notifications import sms
from apps.payments import services as payments
from apps.payments.models import Payment

MEDIA = tempfile.mkdtemp(prefix="agapy-catalog-tests-")
URL = "/api/v1/catalog/"


def artwork_data(**extra):
    data = {
        "title": "Lagune au matin", "summary": "La lagune Ébrié.", "technique": "Huile sur toile",
        "discipline": "peinture", "height_cm": "80", "width_cm": "60", "frame": "gold",
        "copyright_office": "BURIDA", "copyright_contact": "Abidjan", "owner_certified": "true",
        "image": image_file("oeuvre.png"),
    }
    data.update(extra)
    return data


@override_settings(MEDIA_ROOT=MEDIA, PAYMENT_PROVIDERS={"card": "apps.payments.providers.fake.FakeProvider",
                                                         "momo": "apps.payments.providers.fake.FakeProvider"})
class CatalogTests(BaseTestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.artist = self.user.artist
        self.client.force_authenticate(self.user)

    def create(self, **extra):
        r = self.client.post(f"{URL}me/artworks/", artwork_data(**extra), format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_owner_certification_required(self):
        r = self.client.post(f"{URL}me/artworks/", artwork_data(owner_certified="false"), format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["owner_certified"], ["owner_certification_required"])

    def test_excerpt_too_long(self):
        r = self.client.post(f"{URL}me/artworks/", artwork_data(excerpt_duration="45"), format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("excerpt_too_long", r.data["codes"]["excerpt_duration"])

    def test_full_publication_flow(self):
        # 1re œuvre : publication gratuite de l'ouverture
        first = self.create()
        self.assertEqual(first["status"], "draft")
        self.assertEqual(first["author_name"], "Awa Koné")
        r = self.client.post(f"{URL}me/artworks/{first['id']}/submit/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["free_publication"])
        self.assertEqual(r.data["artwork"]["status"], "pending_review")
        self.assertTrue(Gallery.objects.get(artist=self.artist).free_publication_used)

        # 2e œuvre : paiement du droit de publication
        second = self.create(title="Marché du Plateau")
        r = self.client.post(f"{URL}me/artworks/{second['id']}/submit/", {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["method"], ["required"])
        r = self.client.post(f"{URL}me/artworks/{second['id']}/submit/", {"method": "momo"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["artwork"]["status"], "awaiting_payment")
        self.assertEqual(r.data["payment"]["amount_ttc"], "3000.00")
        self.assertIn("checkout_url", r.data["action"])
        payments.confirm_payment(Payment.objects.get(reference=r.data["payment"]["reference"]))
        artwork = Artwork.objects.get(slug=second["id"])
        self.assertEqual(artwork.status, ArtworkStatus.PENDING_REVIEW)

        # Pas encore visible
        self.assertEqual(self.client.get(f"{URL}artworks/").data["count"], 0)

        # Modération : validation → SMS et visible publiquement
        services.approve_artwork(artwork)
        self.assertIn("validée", sms.outbox[-1]["message"])
        self.client.force_authenticate(None)
        r = self.client.get(f"{URL}artworks/")
        self.assertEqual(r.data["count"], 1)
        r = self.client.get(f"{URL}artworks/{artwork.slug}/")
        self.assertEqual(r.data["view_count"], 1)
        r = self.client.get(f"{URL}artists/{self.artist.slug}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["copyright_office"], "BURIDA")
        self.assertEqual(len(r.data["artworks"]), 1)
        self.assertEqual(r.data["address"], 1)

        # Modifier le titre d'une œuvre publiée la renvoie en modération
        self.client.force_authenticate(self.user)
        r = self.client.patch(f"{URL}me/artworks/{artwork.slug}/", {"title": "Marché du soir"}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "pending_review")

    def test_rejected_artwork_resubmitted_without_new_payment(self):
        a = self.create()
        self.client.post(f"{URL}me/artworks/{a['id']}/submit/", {}, format="json")
        artwork = Artwork.objects.get(slug=a["id"])
        services.reject_artwork(artwork, "Image floue")
        r = self.client.post(f"{URL}me/artworks/{a['id']}/submit/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNone(r.data["payment"])
        self.assertEqual(r.data["artwork"]["status"], "pending_review")

    def test_inactive_and_red_listed_cannot_submit(self):
        a = self.create()
        self.artist.status = ArtistStatus.DORMANT
        self.artist.save()
        r = self.client.post(f"{URL}me/artworks/{a['id']}/submit/", {}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["codes"]["detail"], "account_inactive")

        self.artist.status = ArtistStatus.ACTIVE
        self.artist.red_listed_until = timezone.localdate() + timedelta(days=10)
        self.artist.save()
        r = self.client.post(f"{URL}me/artworks/{a['id']}/submit/", {}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["codes"]["detail"], "red_listed")

    def test_moderation_removals(self):
        a = self.create()
        artwork = Artwork.objects.get(slug=a["id"])
        services.remove_inappropriate(artwork, "Contenu choquant")
        self.artist.refresh_from_db()
        self.assertTrue(self.artist.is_red_listed)
        self.assertEqual(Artwork.objects.get(pk=artwork.pk).status, ArtworkStatus.REMOVED)

        b = self.create(title="Copie")
        services.remove_stolen(Artwork.objects.get(slug=b["id"]), "Œuvre volée")
        self.artist.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.artist.status, ArtistStatus.EXCLUDED)
        self.assertFalse(self.user.is_active)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{URL}artists/{self.artist.slug}/").status_code, 404)

    def test_gallery_and_free_galleries(self):
        r = self.client.patch(f"{URL}me/gallery/", {"is_free": True}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["currently_free"])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{URL}free-galleries/").data["count"], 1)
        Gallery.objects.update(free_until=timezone.localdate() - timedelta(days=1))
        self.assertEqual(self.client.get(f"{URL}free-galleries/").data["count"], 0)

    def test_search(self):
        a = self.create()
        services.approve_artwork(Artwork.objects.get(slug=a["id"]))
        self.client.force_authenticate(None)
        r = self.client.get(f"{URL}search/", {"artist": "awa"})
        self.assertTrue(r.data["found"])
        self.assertEqual(len(r.data["artists"]), 1)
        r = self.client.get(f"{URL}search/", {"artist": "awa", "title": "lagune"})
        self.assertEqual(len(r.data["artworks"]), 1)
        r = self.client.get(f"{URL}search/", {"artist": "Picasso"})
        self.assertFalse(r.data["found"])
        self.assertEqual(r.data["code"], "artist_not_found")
        self.assertIn("ne figure pas sur AGAPY-GALLERY", r.data["detail"])
        r = self.client.get(f"{URL}search/", {"title": "Joconde"})
        self.assertEqual(r.data["code"], "artwork_not_found")
        self.assertEqual(self.client.get(f"{URL}frames/").status_code, 200)
