from decimal import Decimal
from unittest import mock

from django.test import override_settings

from apps.accounts.models import ArtistStatus
from apps.accounts.tests.helpers import BaseTestCase, make_artist
from apps.payments import services
from apps.payments.models import (
    LedgerAccount, LedgerEntry, Payment, PayoutRequest, PayoutStatus, VisitLog, VisitPass,
)

API = "/api/v1/payments"


@override_settings(PAYMENT_SIMULATION_ENABLED=True)
class PaymentFlowTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.artist = self.user.artist

    def simulate(self, reference, result="succeeded"):
        return self.client.post(f"{API}/{reference}/simulate/", {"status": result}, format="json")

    # --- génériques -------------------------------------------------------
    def test_quote(self):
        r = self.client.get(f"{API}/quote/", {"kind": "visit", "region": "africa"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.data["amount_ht"], r.data["vat"], r.data["amount_ttc"]), ("250", "50", "300"))

    @override_settings(PAYMENT_SIMULATION_ENABLED=False)
    def test_simulation_disabled(self):
        p = services.create_visit_payment(self.artist, "momo", "africa", {})
        self.assertEqual(self.simulate(p.reference).status_code, 404)

    def test_webhook_idempotent(self):
        r = self.client.post(f"{API}/visits/", {"artist": self.artist.slug, "method": "card", "region": "europe"},
                             format="json")
        ref = r.data["payment"]["reference"]
        for _ in range(2):
            r = self.client.post(f"{API}/webhook/fake/", {"reference": ref, "status": "succeeded"}, format="json")
            self.assertEqual(r.status_code, 200)
        self.assertEqual(VisitPass.objects.count(), 1)
        self.assertEqual(LedgerEntry.objects.filter(payment__reference=ref).count(), 6)

    # --- ouverture de compte ------------------------------------------------
    def test_signup_payment_activates_account(self):
        pending = make_artist(phone="+2250700000001", status=ArtistStatus.PENDING_PAYMENT).artist
        r = self.client.post(f"{API}/signup/", {"artist": pending.slug, "method": "momo"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["payment"]["amount_ttc"], "12000.00")
        self.simulate(r.data["payment"]["reference"])
        pending.refresh_from_db()
        self.assertEqual(pending.status, ArtistStatus.ACTIVE)
        self.assertEqual(LedgerEntry.objects.get(account=LedgerAccount.AGAPY).amount, Decimal("10000"))

    def test_signup_rejects_active_and_wallet(self):
        r = self.client.post(f"{API}/signup/", {"artist": self.artist.slug, "method": "momo"}, format="json")
        self.assertEqual((r.status_code, r.data["codes"]["detail"]), (409, "not_pending_payment"))
        r = self.client.post(f"{API}/signup/", {"artist": self.artist.slug, "method": "wallet"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"{API}/signup/", {"artist": "inconnu", "method": "momo"}, format="json")
        self.assertEqual(r.data["codes"]["detail"], "artist_not_found")

    # --- visites --------------------------------------------------------------
    def test_paid_visit_flow(self):
        r = self.client.get(f"{API}/visits/access/", {"artist": self.artist.slug})
        self.assertFalse(r.data["access"])
        r = self.client.post(f"{API}/visits/", {"artist": self.artist.slug, "method": "momo", "region": "africa",
                                                "payer_email": "v@exemple.com"}, format="json")
        self.assertEqual(r.status_code, 201)
        ref = r.data["payment"]["reference"]
        self.assertNotIn("payer_email", r.data["payment"])
        self.simulate(ref)
        status_ = self.client.get(f"{API}/{ref}/").data
        token = status_["visit"]["token"]
        r = self.client.get(f"{API}/visits/access/", {"artist": self.artist.slug}, HTTP_X_VISIT_TOKEN=token)
        self.assertEqual((r.data["access"], r.data["free"]), (True, False))
        r = self.client.get(f"{API}/visits/access/", {"artist": self.artist.slug}, HTTP_X_VISIT_TOKEN="faux")
        self.assertEqual((r.status_code, r.data["codes"]["detail"]), (403, "visit_token_invalid"))
        self.assertEqual(VisitLog.objects.filter(free=False).count(), 1)

        # Répartition : 250 HT → 187,5→188 artiste… la somme fait toujours 250, TVA 50 à part
        entries = {e.account: e.amount for e in LedgerEntry.objects.filter(payment__reference=ref)}
        self.assertEqual(entries[LedgerAccount.VAT], Decimal("50"))
        self.assertEqual(sum(v for k, v in entries.items() if k != LedgerAccount.VAT), Decimal("250"))
        self.assertEqual(entries[LedgerAccount.COPYRIGHT_OFFICE], Decimal("5"))

    def test_free_gallery(self):
        with mock.patch.object(services, "gallery_is_free", return_value=True):
            r = self.client.post(f"{API}/visits/", {"artist": self.artist.slug, "method": "momo", "region": "africa"},
                                 format="json")
            self.assertEqual((r.status_code, r.data["free"]), (200, True))
            self.client.get(f"{API}/visits/access/", {"artist": self.artist.slug})
        self.assertEqual(Payment.objects.count(), 0)
        self.assertEqual(VisitLog.objects.filter(free=True).count(), 1)  # même visiteur : compté une fois

    # --- dons ---------------------------------------------------------------------
    def test_donation(self):
        r = self.client.post(f"{API}/donations/", {"artist": self.artist.slug, "amount": "50", "region": "africa",
                                                   "method": "momo"}, format="json")
        self.assertEqual(r.data["codes"]["detail"], "invalid_amount")
        r = self.client.post(f"{API}/donations/", {"artist": self.artist.slug, "amount": "1000", "region": "africa",
                                                   "method": "momo", "payer_name": "Ami", "message": "Bravo"},
                             format="json")
        self.assertEqual((r.status_code, r.data["payment"]["vat"]), (201, "0.00"))
        self.simulate(r.data["payment"]["reference"])
        self.assertEqual(LedgerEntry.objects.get(account=LedgerAccount.ARTIST).amount, Decimal("850"))

    # --- espace artiste -------------------------------------------------------------
    def test_balance_and_payouts(self):
        p = services.create_donation_payment(self.artist, Decimal("2000"), "XOF", "africa", "momo", {})
        services.confirm_payment(p)
        self.auth(self.login().data["access"])

        bal = self.client.get(f"{API}/me/balance/").data[0]
        self.assertEqual((bal["currency"], bal["available"]), ("XOF", "1700.00"))
        tx = self.client.get(f"{API}/me/transactions/").data
        self.assertEqual(tx["results"][0]["artist_share"], "1700.00")

        r = self.client.post(f"{API}/me/payouts/", {"amount": "5000", "currency": "XOF", "channel": "momo"})
        self.assertEqual(r.data["codes"]["detail"], "insufficient_balance")
        r = self.client.post(f"{API}/me/payouts/", {"amount": "1000", "currency": "XOF", "channel": "iban"})
        self.assertEqual(r.data["codes"]["detail"], "payout_channel_missing")
        r = self.client.post(f"{API}/me/payouts/", {"amount": "1000", "currency": "XOF", "channel": "momo"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.get(f"{API}/me/balance/").data[0]["available"], "700.00")

        payout = PayoutRequest.objects.get()
        self.assertTrue(services.mark_payout_paid(payout))
        self.assertFalse(services.mark_payout_paid(payout))
        bal = self.client.get(f"{API}/me/balance/").data[0]
        self.assertEqual((bal["available"], bal["paid_out"]), ("700.00", "1000.00"))
        self.assertEqual(PayoutRequest.objects.get().status, PayoutStatus.PAID)
        self.assertEqual(self.client.get(f"{API}/me/payouts/").data["count"], 1)

    def test_me_requires_auth(self):
        self.assertEqual(self.client.get(f"{API}/me/balance/").status_code, 401)
