"""
Parcours complet à travers tous les modules, tel que décrit par le cahier des charges :
inscription → paiement d'ouverture → abonnement et Compte d'Avoir → publication payée par le
Compte d'Avoir → modération → visite payante → répartition → solde de l'artiste.
"""
import shutil
import tempfile
from decimal import Decimal

from django.test import override_settings

from apps.accounts.models import ArtistStatus
from apps.accounts.tests.helpers import BaseTestCase, image_file, make_artist
from apps.catalog import services as catalog
from apps.catalog.models import Artwork, ArtworkStatus
from apps.payments.models import LedgerAccount, LedgerEntry, VisitLog

MEDIA = tempfile.mkdtemp(prefix="agapy-parcours-")


def artwork(title):
    return {
        "title": title, "summary": "Résumé.", "technique": "Huile sur toile", "discipline": "peinture",
        "height_cm": "80", "width_cm": "60", "frame": "gold", "copyright_office": "BURIDA",
        "copyright_contact": "Abidjan", "owner_certified": "true", "image": image_file(f"{title}.png"),
    }


@override_settings(MEDIA_ROOT=MEDIA, PAYMENT_SIMULATION_ENABLED=True)
class ParcoursCompletTests(BaseTestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def pay(self, response):
        self.assertIn(response.status_code, (200, 201), response.data)
        ref = response.data["payment"]["reference"]
        r = self.client.post(f"/api/v1/payments/{ref}/simulate/", {"status": "succeeded"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        return ref

    def test_parcours(self):
        user = make_artist(status=ArtistStatus.PENDING_PAYMENT)
        artist = user.artist

        # 1. Paiement des frais d'ouverture : compte activé, abonnement d'un an, Compte d'Avoir créé
        self.pay(self.client.post("/api/v1/payments/signup/", {"artist": artist.slug, "method": "momo"}, format="json"))
        artist.refresh_from_db()
        self.assertEqual(artist.status, ArtistStatus.ACTIVE)
        self.client.force_authenticate(user)
        sub = self.client.get("/api/v1/subscriptions/me/").data
        self.assertEqual(sub["state"], "active")

        # 2. Activation et recharge du Compte d'Avoir
        self.assertEqual(self.client.patch("/api/v1/subscriptions/me/wallet/", {"is_active": True},
                                           format="json").status_code, 200)
        self.pay(self.client.post("/api/v1/subscriptions/me/wallet/topup/", {"amount": "10000", "method": "momo"},
                                  format="json"))

        # 3. Première publication gratuite, la seconde payée par le Compte d'Avoir (3 000 F TTC)
        first = self.client.post("/api/v1/catalog/me/artworks/", artwork("Lagune"), format="multipart").data
        r = self.client.post(f"/api/v1/catalog/me/artworks/{first['id']}/submit/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        second = self.client.post("/api/v1/catalog/me/artworks/", artwork("Harmattan"), format="multipart").data
        r = self.client.post(f"/api/v1/catalog/me/artworks/{second['id']}/submit/", {"method": "wallet"},
                             format="json")
        self.assertIn(r.status_code, (200, 201), r.data)
        self.assertEqual(Artwork.objects.get(slug=second["id"]).status, ArtworkStatus.PENDING_REVIEW)
        wallet = self.client.get("/api/v1/subscriptions/me/wallet/").data
        self.assertEqual(Decimal(wallet["balance"]), Decimal("7000"))

        # 4. Modération : les œuvres validées deviennent publiques
        for work in Artwork.objects.filter(artist=artist):
            catalog.approve_artwork(work)
        self.client.force_authenticate(None)
        r = self.client.get("/api/v1/catalog/artworks/", {"artist": artist.slug})
        self.assertEqual(r.data["count"], 2)

        # 5. Visite payante (250 F HT + TVA) : droit de visite et visite comptée
        ref = self.pay(self.client.post("/api/v1/payments/visits/", {"artist": artist.slug, "method": "momo",
                                                                      "region": "africa"}, format="json"))
        token = self.client.get(f"/api/v1/payments/{ref}/").data["visit"]["token"]
        r = self.client.get("/api/v1/payments/visits/access/", {"artist": artist.slug}, HTTP_X_VISIT_TOKEN=token)
        self.assertTrue(r.data["access"])
        self.assertEqual(VisitLog.objects.filter(artist=artist, free=False).count(), 1)

        # 6. Répartition et solde : l'artiste reçoit 75 % de la visite ; le compte de provision est tracé
        artist_share = LedgerEntry.objects.get(payment__reference=ref, account=LedgerAccount.ARTIST).amount
        self.assertEqual(artist_share, Decimal("188"))  # 75 % de 250 F, arrondi au franc
        self.client.force_authenticate(user)
        balance = self.client.get("/api/v1/payments/me/balance/")
        self.assertEqual(balance.status_code, 200)
        self.assertIn("188", str(balance.data))
