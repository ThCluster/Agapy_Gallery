from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.models import ArtistProfile, User
from apps.accounts.tests.helpers import PASSWORD, BaseTestCase, make_artist, image_file
from apps.catalog.models import Artwork, ArtworkStatus
from apps.core.pricing import donation_quote, quote
from apps.dashboards.models import StatementLog
from apps.notifications import sms
from apps.payments.models import LedgerEntry, VisitLog
from apps.payments.services import confirm_payment, create_payment

API = "/api/v1/dashboards"


def pay_visit(artist, region="africa"):
    p = create_payment(purpose="visit", method="momo", quote=quote("visit", region), region=region, artist=artist)
    return confirm_payment(p)


def pay_donation(artist, amount="1000", currency="XOF"):
    p = create_payment(purpose="donation", method="momo", quote=donation_quote(Decimal(amount), currency),
                       region="africa", artist=artist)
    return confirm_payment(p)


def make_artwork(artist, status=ArtworkStatus.PUBLISHED, views=0, published_at=None, title="Œuvre"):
    return Artwork.objects.create(
        artist=artist, title=title, summary="r", technique="huile", height_cm=10, width_cm=10, image=image_file(),
        copyright_office="BURIDA", owner_certified=True, status=status, view_count=views,
        published_at=published_at if published_at is not None else (
            timezone.now() if status == ArtworkStatus.PUBLISHED else None),
    )


class ArtistDashboardTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.artist = self.user.artist
        self.client.force_authenticate(self.user)

    def test_not_an_artist(self):
        staff = User.objects.create_user(phone="+2250700000009", password=PASSWORD)
        self.client.force_authenticate(staff)
        r = self.client.get(f"{API}/me/summary/")
        self.assertEqual((r.status_code, r.data["codes"]["detail"]), (403, "not_an_artist"))

    def test_summary(self):
        pay_visit(self.artist)
        pay_donation(self.artist, "2000")
        VisitLog.objects.create(artist=self.artist, free=True)
        make_artwork(self.artist, views=7, title="A")
        make_artwork(self.artist, views=3, title="B")
        make_artwork(self.artist, status=ArtworkStatus.PENDING_REVIEW)
        make_artwork(self.artist, status=ArtworkStatus.DRAFT, views=1)
        r = self.client.get(f"{API}/me/summary/")
        self.assertEqual(r.status_code, 200)
        d = r.data
        # visite 250 HT → 75 % = 187.50, arrondi à 188 F (pas de centimes) ; don 2000 → 85 % = 1700
        self.assertEqual(d["currency"], "XOF")
        self.assertEqual(d["total_earned"], "1888.00")
        self.assertEqual(d["available_balance"], "1888.00")
        self.assertEqual(d["provision_held"], "5.00")
        self.assertEqual(d["visits"], {"total": 2, "paid": 1, "free": 1, "last_30_days": 2})
        self.assertEqual(d["donations"], {"count": 1, "total": "1700.00"})
        self.assertEqual(d["artworks"], {"published": 2, "pending_review": 1, "rejected": 0, "draft": 1,
                                         "total_views": 11})
        self.assertEqual([a["title"] for a in d["top_artworks"]], ["A", "B"])

    def test_revenue_series(self):
        pay_visit(self.artist)
        pay_donation(self.artist, "1000")
        old = pay_donation(self.artist, "2000")
        two_months_ago = timezone.now() - timedelta(days=62)
        LedgerEntry.objects.filter(payment=old).update(created_at=two_months_ago)
        pay_donation(self.artist, "10", "EUR")

        r = self.client.get(f"{API}/me/revenue/")
        self.assertEqual(r.status_code, 200)
        d = r.data
        self.assertEqual((d["currency"], d["period"], len(d["series"])), ("XOF", "month", 12))
        self.assertEqual(d["currencies"], ["XOF", "EUR"])
        last = d["series"][-1]
        self.assertEqual(last, {"start": timezone.localdate().replace(day=1).isoformat(), "visits": "188.00",
                                "donations": "850.00", "total": "1038.00", "visit_count": 1})
        self.assertEqual(d["totals"]["total"], "2738.00")
        self.assertEqual(sum(1 for p in d["series"] if p["total"] != "0.00"), 2)

        r = self.client.get(f"{API}/me/revenue/", {"currency": "EUR", "period": "year"})
        self.assertEqual((r.data["totals"]["donations"], len(r.data["series"])), ("8.50", 12))

        today = timezone.localdate()
        r = self.client.get(f"{API}/me/revenue/", {"period": "day", "from": (today - timedelta(days=6)).isoformat(),
                                                   "to": today.isoformat()})
        self.assertEqual((len(r.data["series"]), r.data["totals"]["visit_count"]), (7, 1))
        r = self.client.get(f"{API}/me/revenue/", {"period": "week", "from": "2026-11-11", "to": "2026-11-19"})
        self.assertEqual([p["start"] for p in r.data["series"]], ["2026-11-09", "2026-11-16"])
        r = self.client.get(f"{API}/me/revenue/", {"period": "quarter", "from": "2026-02-10", "to": "2026-11-19"})
        self.assertEqual([p["start"] for p in r.data["series"]],
                         ["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"])

    def test_revenue_errors(self):
        r = self.client.get(f"{API}/me/revenue/", {"period": "day", "from": "2020-01-01", "to": "2026-01-01"})
        self.assertEqual((r.status_code, r.data["codes"]["detail"]), (400, "range_too_large"))
        r = self.client.get(f"{API}/me/revenue/", {"period": "hour"})
        self.assertEqual(r.data["codes"]["detail"], "invalid_period")
        r = self.client.get(f"{API}/me/revenue/", {"currency": "GBP"})
        self.assertEqual(r.data["codes"]["detail"], "invalid_currency")
        r = self.client.get(f"{API}/me/revenue/", {"from": "2026-05-01", "to": "2026-01-01"})
        self.assertEqual(r.data["codes"]["detail"], "invalid_range")
        r = self.client.get(f"{API}/me/revenue/", {"from": "hier"})
        self.assertEqual(r.status_code, 400)


class StaffDashboardTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.artist = make_artist().artist
        self.other = make_artist(phone="+2250700000001", artist_name="Kofi").artist
        pay_visit(self.artist)
        pay_visit(self.other)
        pay_visit(self.other)
        pay_donation(self.artist, "5000")
        make_artwork(self.artist, status=ArtworkStatus.PENDING_REVIEW)
        self.staff = User.objects.create_superuser(phone="+2250700000099", password=PASSWORD, email="a@b.c")

    def test_overview_requires_staff(self):
        self.client.force_authenticate(self.artist.user)
        self.assertEqual(self.client.get(f"{API}/staff/overview/").status_code, 403)

    def test_overview(self):
        self.client.force_authenticate(self.staff)
        r = self.client.get(f"{API}/staff/overview/", {"period": "week"})
        self.assertEqual(r.status_code, 200)
        d = r.data
        self.assertEqual(d["pending_moderation"], 1)
        month = d["figures"]["month"]
        visits = next(p for p in month["payments"] if p["purpose"] == "visit")
        self.assertEqual((visits["count"], visits["totals"]["XOF"]), (3, "900.00"))
        # 3 × 49 (20 % + reliquat d'arrondi réparti par split) + 15 % de 5000
        self.assertEqual(month["agapy_revenue"], {"XOF": "897.00"})
        self.assertEqual(month["new_signups"], 2)
        self.assertEqual(d["rankings"]["by_revenue"][0]["id"], self.artist.slug)
        self.assertEqual(d["rankings"]["by_visits"][0]["id"], self.other.slug)
        self.assertEqual(self.client.get(f"{API}/staff/overview/", {"period": "x"}).status_code, 400)

    def test_admin_page(self):
        self.client.force_login(self.staff)
        r = self.client.get("/admin/")
        self.assertContains(r, "/admin/tableau-de-bord/")
        r = self.client.get("/admin/tableau-de-bord/", {"period": "year"})
        self.assertContains(r, "Artistes les plus visités")
        self.assertContains(r, "Kofi")
        self.client.logout()
        self.assertEqual(self.client.get("/admin/tableau-de-bord/").status_code, 302)


class QuarterlyStatementTests(BaseTestCase):
    def test_send_once_per_quarter(self):
        artist = make_artist().artist
        pay_donation(artist, "40000")  # 85 % → 34 000
        active = make_artist(phone="+2250700000001", status="dormant").artist
        make_artwork(active)
        make_artist(phone="+2250700000002", status="pending_payment")

        out = StringIO()
        call_command("send_quarterly_statements", "--dry-run", "--quarter", "2026-Q4", stdout=out)
        self.assertIn("2 bilan(s) à envoyer", out.getvalue())
        self.assertEqual((StatementLog.objects.count(), len(sms.outbox)), (0, 0))

        call_command("send_quarterly_statements", "--quarter", "2026-Q4", stdout=StringIO())
        self.assertEqual(StatementLog.objects.count(), 2)
        messages = {m["to"]: m["message"] for m in sms.outbox}
        first = messages[artist.user.phone]
        self.assertIn("disponibilité financière de 34 000 F CFA", first)
        self.assertIn("Cela fait un moment", first)
        self.assertNotIn("Cela fait un moment", messages[active.user.phone])
        self.assertEqual(len(mail.outbox), 2)

        call_command("send_quarterly_statements", "--quarter", "2026-Q4", stdout=StringIO())
        self.assertEqual((StatementLog.objects.count(), len(sms.outbox)), (2, 2))
        self.assertTrue(ArtistProfile.objects.exists())
