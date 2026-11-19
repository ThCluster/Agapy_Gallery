from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import override_settings
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.tests.helpers import BaseTestCase, last_sms_code, make_artist
from apps.accounts.tests.test_signup_profile import signup_data
from apps.notifications import sms
from apps.payments import services as payments
from apps.payments.models import LedgerEntry, Payment, PaymentStatus, VisitPass
from apps.subscriptions import services as wallets
from apps.subscriptions.models import Wallet
from apps.visitors.models import SignupCode, VisitorProfile

API = "/api/v1/visitors"
PHONE_LOCAL = "07 11 22 33 44"
PHONE = "+2250711223344"
PASSWORD = "VISIT2026"


class Base(BaseTestCase):
    def request_code(self, phone=PHONE_LOCAL, country="CI"):
        return self.client.post(f"{API}/signup/code/", {"phone_country": country, "phone": phone}, format="json")

    def signup(self, code=None, **extra):
        data = {"phone_country": "CI", "phone": PHONE_LOCAL, "display_name": "Jean Client",
                "email": "jean@exemple.com", "country": "FR", "password": PASSWORD}
        if code is None:
            self.request_code()
            code = last_sms_code()
        data.update(code=code, **extra)
        return self.client.post(f"{API}/signup/", data, format="json")

    def make_visitor(self, country="CI"):
        r = self.signup(country=country)
        self.assertEqual(r.status_code, 201, r.data)
        self.client.credentials()
        return User.objects.get(phone=PHONE)

    def fund(self, user, amount="10000", active=True):
        wallet = wallets.ensure_visitor_wallet(user)
        wallet.is_active = active
        wallet.save()
        if amount:
            wallets._add_entry(wallet, Decimal(amount), "Test")
        return wallet


class SignupCodeTests(Base):
    def test_code_sent_hashed(self):
        r = self.request_code()
        self.assertEqual(r.status_code, 202)
        self.assertEqual(r.data["expires_in_minutes"], 10)
        self.assertEqual(sms.outbox[-1]["to"], PHONE)
        code = last_sms_code()
        entry = SignupCode.objects.get(phone=PHONE)
        self.assertNotIn(code, entry.code_hash)

    def test_phone_taken(self):
        make_artist(phone=PHONE)
        r = self.request_code()
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["phone"], ["phone_taken"])
        self.assertEqual(sms.outbox, [])

    def test_cooldown_and_caps(self):
        self.request_code()
        self.request_code()  # délai entre deux envois : rien de plus
        self.assertEqual(len(sms.outbox), 1)

    def test_wrong_code_attempts_then_invalid(self):
        self.request_code()
        good = last_sms_code()
        bad = "000000" if good != "000000" else "111111"
        for _ in range(5):
            r = self.signup(code=bad)
            self.assertEqual(r.data["codes"]["code"], ["code_invalid"])
        self.assertEqual(SignupCode.objects.get(phone=PHONE).attempts, 5)
        r = self.signup(code=good)  # 5 essais épuisés
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(phone=PHONE).exists())

    def test_expired_code(self):
        self.request_code()
        code = last_sms_code()
        SignupCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        r = self.signup(code=code)
        self.assertEqual(r.data["codes"]["code"], ["code_invalid"])


class SignupTests(Base):
    def test_signup_logs_in_and_creates_wallet(self):
        r = self.signup()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("access", r.data)
        self.assertIn("agapy_refresh", r.cookies)
        self.assertIsNone(r.data["user"]["artist"])
        v = r.data["user"]["visitor"]
        self.assertEqual((v["display_name"], v["country"], v["region"]), ("Jean Client", "FR", "europe"))
        user = User.objects.get(phone=PHONE)
        self.assertTrue(user.is_active and user.check_password(PASSWORD))
        wallet = Wallet.objects.get(user=user)
        self.assertEqual((wallet.is_active, wallet.currency, wallet.artist_id), (False, "EUR", None))
        # Code à usage unique
        code = SignupCode.objects.get(phone=PHONE)
        self.assertIsNotNone(code.used_at)

    def test_password_rule_checked_before_code(self):
        self.request_code()
        code = last_sms_code()
        r = self.signup(code=code, password="short")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["password"][0], "password_format")
        self.assertEqual(SignupCode.objects.get(phone=PHONE).attempts, 0)
        self.assertEqual(self.signup(code=code).status_code, 201)

    def test_phone_taken_at_signup(self):
        self.request_code()
        code = last_sms_code()
        make_artist(phone=PHONE)
        r = self.signup(code=code)
        self.assertEqual(r.data["codes"]["phone"], ["phone_taken"])

    def test_artist_signup_refuses_visitor_phone(self):
        self.make_visitor()
        r = self.client.post("/api/v1/accounts/signup/", signup_data(phone=PHONE_LOCAL), format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["phone"], ["phone_taken"])
        self.assertFalse(hasattr(User.objects.get(phone=PHONE), "artist"))

    def test_wallet_single_owner_constraint(self):
        user = self.make_visitor()
        artist = make_artist(phone="+2250700000009").artist
        with self.assertRaises(IntegrityError), transaction.atomic():
            Wallet.objects.create(currency="XOF")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Wallet.objects.filter(user=user).update(artist=artist)


class LoginAndProfileTests(Base):
    def test_login_refresh_me(self):
        self.make_visitor()
        r = self.login(phone=PHONE_LOCAL, password=PASSWORD)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNone(r.data["user"]["artist"])
        self.assertEqual(r.data["user"]["visitor"]["display_name"], "Jean Client")
        self.auth(r.data["access"])
        me = self.client.get("/api/v1/accounts/me/")
        self.assertEqual(me.status_code, 200)
        self.assertIsNotNone(me.data["visitor"])
        self.assertEqual(self.client.post("/api/v1/auth/refresh/").status_code, 200)
        # Les espaces artiste sont refusés
        self.assertEqual(self.client.get("/api/v1/subscriptions/me/wallet/").status_code, 403)
        self.assertEqual(self.client.patch("/api/v1/accounts/me/", {"bio": "x"}, format="json").status_code, 403)

    def test_artist_me_has_no_visitor(self):
        make_artist()
        r = self.login()
        self.assertIsNone(r.data["user"]["visitor"])
        self.assertIsNotNone(r.data["user"]["artist"])
        self.auth(r.data["access"])
        self.assertEqual(self.client.get(f"{API}/me/").data["codes"]["detail"], "not_a_visitor")

    def test_profile_patch_country_readonly(self):
        user = self.make_visitor(country="FR")
        self.client.force_authenticate(user)
        r = self.client.patch(f"{API}/me/", {"display_name": "Jean D.", "email": "new@exemple.com", "country": "CI"},
                              format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["display_name"], r.data["email"], r.data["country"]), ("Jean D.", "new@exemple.com", "FR"))
        r = self.client.patch(f"{API}/me/", {"display_name": "  "}, format="json")
        self.assertEqual(r.status_code, 400)


@override_settings(PAYMENT_SIMULATION_ENABLED=True)
class VisitorWalletTests(Base):
    def setUp(self):
        super().setUp()
        self.visitor = self.make_visitor(country="CI")
        self.artist = make_artist(phone="+2250700000009").artist
        self.client.force_authenticate(self.visitor)

    def test_toggle_and_topup(self):
        r = self.client.get(f"{API}/me/wallet/")
        self.assertEqual((r.data["is_active"], r.data["balance"], r.data["currency"]), (False, "0.00", "XOF"))
        r = self.client.post(f"{API}/me/wallet/topup/", {"amount": "5000", "method": "momo"}, format="json")
        self.assertEqual(r.data["codes"]["detail"], "wallet_inactive")
        r = self.client.patch(f"{API}/me/wallet/", {"is_active": True}, format="json")
        self.assertTrue(r.data["is_active"])
        r = self.client.post(f"{API}/me/wallet/topup/", {"amount": "100", "method": "momo"}, format="json")
        self.assertEqual(r.data["codes"]["detail"], "amount_too_low")
        r = self.client.post(f"{API}/me/wallet/topup/", {"amount": "5000", "method": "wallet"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"{API}/me/wallet/topup/", {"amount": "5000", "method": "momo"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        p = Payment.objects.get(reference=r.data["payment"]["reference"])
        self.assertEqual((p.artist_id, p.payer_user_id, p.region), (None, self.visitor.pk, "africa"))
        payments.confirm_payment(p)
        payments.confirm_payment(p)
        r = self.client.get(f"{API}/me/wallet/")
        self.assertEqual(r.data["balance"], "5000.00")
        self.assertEqual(r.data["history"]["count"], 1)
        self.assertFalse(LedgerEntry.objects.filter(payment=p).exists())  # un dépôt, pas un revenu

    def test_visit_paid_with_wallet(self):
        self.fund(self.visitor, "1000")
        r = self.client.post("/api/v1/payments/visits/", {"artist": self.artist.slug, "method": "wallet",
                                                          "region": "europe"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["action"], {"status": "succeeded"})
        self.assertEqual(r.data["payment"]["currency"], "XOF")  # zone du Compte d'Avoir, pas celle envoyée
        token = r.data["payment"]["visit"]["token"]
        self.assertEqual(Wallet.objects.get(user=self.visitor).balance, Decimal("700"))
        # Le Compte d'Avoir de l'artiste bénéficiaire n'est pas touché
        self.assertFalse(Wallet.objects.filter(artist=self.artist, entries__isnull=False).exists())
        p = Payment.objects.get(reference=r.data["payment"]["reference"])
        self.assertEqual(p.payer_user, self.visitor)
        self.assertTrue(LedgerEntry.objects.filter(payment=p).exists())
        visits = self.client.get(f"{API}/me/visits/").data
        self.assertEqual(visits[0]["artist"], self.artist.slug)
        self.assertEqual(visits[0]["token"], token)
        pays = self.client.get(f"{API}/me/payments/").data
        self.assertEqual(pays["count"], 1)
        self.assertEqual(pays["results"][0]["visit"]["token"], token)
        access = self.client.get("/api/v1/payments/visits/access/", {"artist": self.artist.slug},
                                 HTTP_X_VISIT_TOKEN=token)
        self.assertTrue(access.data["access"])

    def test_visits_expired_hidden(self):
        self.fund(self.visitor, "1000")
        self.client.post("/api/v1/payments/visits/", {"artist": self.artist.slug, "method": "wallet",
                                                      "region": "africa"}, format="json")
        VisitPass.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.client.get(f"{API}/me/visits/").data, [])

    def test_wallet_insufficient_and_inactive(self):
        self.fund(self.visitor, "100")
        r = self.client.post("/api/v1/payments/visits/", {"artist": self.artist.slug, "method": "wallet",
                                                          "region": "africa"}, format="json")
        self.assertEqual(r.data["codes"]["detail"], "wallet_insufficient")
        self.assertFalse(Payment.objects.filter(status=PaymentStatus.PENDING).exists())
        self.fund(self.visitor, "5000", active=False)
        r = self.client.post("/api/v1/payments/donations/", {"artist": self.artist.slug, "method": "wallet",
                                                             "region": "africa", "amount": "500"}, format="json")
        self.assertEqual(r.data["codes"]["detail"], "wallet_inactive")
        self.assertFalse(Payment.objects.filter(purpose="donation").exists())

    def test_donation_with_wallet(self):
        self.fund(self.visitor, "10000")
        r = self.client.post("/api/v1/payments/donations/", {"artist": self.artist.slug, "method": "wallet",
                                                             "region": "europe", "amount": "2000",
                                                             "payer_name": "Jean"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["payment"]["status"], r.data["payment"]["currency"]), ("succeeded", "XOF"))
        self.assertEqual(Wallet.objects.get(user=self.visitor).balance, Decimal("8000"))

    def test_anonymous_cannot_use_wallet(self):
        self.client.force_authenticate(None)
        for url, extra in (("visits", {}), ("donations", {"amount": "500"})):
            r = self.client.post(f"/api/v1/payments/{url}/", {"artist": self.artist.slug, "method": "wallet",
                                                              "region": "africa", **extra}, format="json")
            self.assertEqual(r.status_code, 400)
            self.assertEqual(r.data["codes"]["detail"], "method_unavailable")
        self.assertFalse(Payment.objects.exists())
        # card / momo restent ouverts aux anonymes
        r = self.client.post("/api/v1/payments/visits/", {"artist": self.artist.slug, "method": "momo",
                                                          "region": "africa"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIsNone(Payment.objects.get().payer_user)

    def test_logged_in_card_visit_is_linked(self):
        r = self.client.post("/api/v1/payments/visits/", {"artist": self.artist.slug, "method": "card",
                                                          "region": "africa"}, format="json")
        self.assertEqual(r.status_code, 201)
        p = Payment.objects.get()
        self.assertEqual(p.payer_user, self.visitor)
        self.client.post(f"/api/v1/payments/{p.reference}/simulate/", {"status": "succeeded"}, format="json")
        self.assertEqual(len(self.client.get(f"{API}/me/visits/").data), 1)


@override_settings(PAYMENT_SIMULATION_ENABLED=True)
class ArtistWalletVisitTests(BaseTestCase):
    def test_artist_pays_visit_with_own_wallet(self):
        payer = make_artist()
        host = make_artist(phone="+2250700000009").artist
        wallet = wallets.ensure_wallet(payer.artist)
        wallet.is_active = True
        wallet.save()
        wallets._add_entry(wallet, Decimal("1000"), "Test")
        self.client.force_authenticate(payer)
        r = self.client.post("/api/v1/payments/visits/", {"artist": host.slug, "method": "wallet",
                                                          "region": "africa"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Wallet.objects.get(artist=payer.artist).balance, Decimal("700"))
        self.assertEqual(len(self.client.get(f"{API}/me/visits/").data), 1)
        r = self.client.post("/api/v1/payments/donations/", {"artist": payer.artist.slug, "method": "wallet",
                                                             "region": "africa", "amount": "500"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["codes"]["detail"], "self_donation")

    def test_visitor_profile_str(self):
        user = User.objects.create_user(phone="+2250700000077", password="ABCD1234")
        profile = VisitorProfile.objects.create(user=user, display_name="Awa", country="ci")
        self.assertEqual(str(profile), "Awa")
