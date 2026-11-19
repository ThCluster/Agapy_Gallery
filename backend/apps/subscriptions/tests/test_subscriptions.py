from datetime import timedelta
from decimal import Decimal

from django.core import mail
from django.utils import timezone

from apps.accounts.models import ArtistProfile, ArtistStatus, User
from apps.accounts.tests.helpers import PASSWORD, BaseTestCase, make_artist
from apps.core.pricing import quote
from apps.notifications import sms
from apps.payments import services as payments
from apps.payments.models import Payment, PaymentStatus
from apps.subscriptions import services
from apps.subscriptions.models import Subscription, Wallet, WalletEntry


class Base(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.artist = self.user.artist
        self.client.force_authenticate(self.user)

    def set_expiry(self, delta):
        sub = services.get_subscription(self.artist)
        sub.expires_at = timezone.now() + delta
        sub.save()
        return sub

    def fund_wallet(self, amount="20000", active=True):
        wallet = services.ensure_wallet(self.artist)
        wallet.is_active = active
        wallet.save()
        services._add_entry(wallet, Decimal(amount), "Test")
        return wallet


class SubscriptionTests(Base):
    def test_signup_payment_creates_subscription_and_inactive_wallet(self):
        artist = make_artist(phone="+2250700000001", status=ArtistStatus.PENDING_PAYMENT).artist
        p = payments.create_payment(purpose="signup", method="momo", quote=quote("signup", artist.region),
                                    region=artist.region, artist=artist)
        payments.confirm_payment(p)
        sub = Subscription.objects.get(artist=artist)
        self.assertAlmostEqual((sub.expires_at - sub.started_at).days, 365, delta=1)
        self.assertFalse(Wallet.objects.get(artist=artist).is_active)

    def test_me_backfills_and_reports_state(self):
        r = self.client.get("/api/v1/subscriptions/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["state"], "active")
        self.assertEqual(r.data["renewal_quote"]["amount_ttc"], "12000")
        self.set_expiry(timedelta(days=10))
        self.assertEqual(self.client.get("/api/v1/subscriptions/me/").data["state"], "soon")

    def test_renewal_extends_and_reactivates(self):
        self.set_expiry(-timedelta(days=5))
        ArtistProfile.objects.filter(pk=self.artist.pk).update(status=ArtistStatus.DORMANT)
        r = self.client.post("/api/v1/subscriptions/me/renew/", {"method": "momo"}, format="json")
        self.assertEqual(r.status_code, 201)
        payments.confirm_payment(Payment.objects.get(reference=r.data["payment"]["reference"]))
        self.artist.refresh_from_db()
        self.assertEqual(self.artist.status, ArtistStatus.ACTIVE)
        days = (Subscription.objects.get(artist=self.artist).expires_at - timezone.now()).days
        self.assertIn(days, (364, 365))

    def test_renewal_early_adds_to_current_period(self):
        sub = self.set_expiry(timedelta(days=20))
        old = sub.expires_at
        services.renew(self.artist)
        sub.refresh_from_db()
        self.assertEqual(sub.expires_at, services.add_year(old))

    def test_expire_puts_dormant_and_reminders_sent_once(self):
        self.set_expiry(timedelta(days=6))
        services.expire_and_remind()
        services.expire_and_remind()
        self.assertEqual(len(sms.outbox), 1)
        self.assertEqual(len(mail.outbox), 1)

        self.set_expiry(-timedelta(minutes=1))
        services.expire_and_remind()
        services.expire_and_remind()
        self.artist.refresh_from_db()
        self.assertEqual(self.artist.status, ArtistStatus.DORMANT)
        self.assertEqual(len(sms.outbox), 2)

    def test_not_an_artist(self):
        staff = User.objects.create_user(phone="+2250700000009", password=PASSWORD)
        self.client.force_authenticate(staff)
        r = self.client.get("/api/v1/subscriptions/me/")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["codes"]["detail"], "not_an_artist")


class WalletTests(Base):
    def renew_with_wallet(self):
        return self.client.post("/api/v1/subscriptions/me/renew/", {"method": "wallet"}, format="json")

    def test_wallet_inactive(self):
        self.fund_wallet(active=False)
        r = self.renew_with_wallet()
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["detail"], "wallet_inactive")

    def test_wallet_insufficient(self):
        self.fund_wallet("5000")
        r = self.renew_with_wallet()
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["detail"], "wallet_insufficient")
        self.assertEqual(Wallet.objects.get(artist=self.artist).balance, Decimal("5000"))

    def test_wallet_payment_ok(self):
        self.fund_wallet("20000")
        sub = self.set_expiry(timedelta(days=3))
        old = sub.expires_at
        r = self.renew_with_wallet()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["action"], {"status": "succeeded"})
        self.assertEqual(r.data["payment"]["status"], PaymentStatus.SUCCEEDED)
        self.assertEqual(Wallet.objects.get(artist=self.artist).balance, Decimal("8000"))
        sub.refresh_from_db()
        self.assertEqual(sub.expires_at, services.add_year(old))
        w = self.client.get("/api/v1/subscriptions/me/wallet/").data
        self.assertEqual(w["balance"], "8000.00")
        self.assertEqual(w["history"]["results"][0]["amount"], "-12000.00")

    def test_toggle_and_topup(self):
        r = self.client.patch("/api/v1/subscriptions/me/wallet/", {"is_active": True}, format="json")
        self.assertTrue(r.data["is_active"])
        self.assertEqual(r.data["currency"], "XOF")
        r = self.client.post("/api/v1/subscriptions/me/wallet/topup/", {"amount": "100", "method": "momo"},
                             format="json")
        self.assertEqual(r.data["codes"]["detail"], "amount_too_low")
        r = self.client.post("/api/v1/subscriptions/me/wallet/topup/", {"amount": "5000", "method": "momo"},
                             format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["payment"]["vat"], "0.00")
        p = Payment.objects.get(reference=r.data["payment"]["reference"])
        payments.confirm_payment(p)
        payments.confirm_payment(p)
        self.assertEqual(Wallet.objects.get(artist=self.artist).balance, Decimal("5000"))
        self.assertEqual(WalletEntry.objects.count(), 1)
