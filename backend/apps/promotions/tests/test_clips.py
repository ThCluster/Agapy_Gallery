import shutil
import tempfile
from datetime import timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.throttling import SimpleRateThrottle

from apps.accounts.tests.helpers import BaseTestCase, make_artist
from apps.payments import services as payments
from apps.payments.models import Payment
from apps.promotions import services
from apps.promotions.models import AdCampaign, AdFormat, Clip, ClipStatus, LiveStream

MEDIA = tempfile.mkdtemp(prefix="agapy-promo-")


MP4_HEAD = b"\x00\x00\x00\x18ftypmp42"
WEBM_HEAD = b"\x1a\x45\xdf\xa3"


def video(name="clip.mp4", size=1024, head=MP4_HEAD):
    return SimpleUploadedFile(name, head + b"0" * size, content_type="video/mp4")


def make_clip(status=ClipStatus.QUEUED, paid_at=None, **kw):
    defaults = dict(title="Expo", advertiser="Galerie X", contact_phone="+2250700000001",
                    video="clips/x.mp4", duration_seconds=30, status=status, paid_at=paid_at or timezone.now())
    defaults.update(kw)
    return Clip.objects.create(**defaults)


@override_settings(MEDIA_ROOT=MEDIA)
class ClipOrderTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, {"clip_create": "1000/hour"})
        patcher.start()
        self.addCleanup(patcher.stop)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def order(self, **overrides):
        data = {"title": "Vernissage", "advertiser": "Galerie X", "contact_phone": "+2250700000001",
                "video": video(), "duration_seconds": 30, "method": "momo"}
        data.update(overrides)
        return self.client.post("/api/v1/promotions/clips/", data, format="multipart")

    def test_order_creates_clip_and_payment(self):
        r = self.order()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["clip"]["status"], ClipStatus.AWAITING_PAYMENT)
        self.assertEqual(r.data["payment"]["amount_ttc"], "3300.00")
        self.assertIn("checkout_url", r.data["action"])
        payment = Payment.objects.get(reference=r.data["payment"]["reference"])
        self.assertEqual(payment.purpose, "clip")
        self.assertEqual(payment.target, Clip.objects.get())

    def test_payment_confirmation_then_approval_starts_playing(self):
        r = self.order()
        self.assertEqual(r.data["action"]["checkout_url"], f"/paiement/simulation?ref={r.data['payment']['reference']}")
        payments.confirm_payment(Payment.objects.get(reference=r.data["payment"]["reference"]))
        clip = Clip.objects.get()
        self.assertEqual(clip.status, ClipStatus.PENDING_REVIEW)  # modération avant diffusion
        self.assertEqual(self.client.get("/api/v1/promotions/clips/live/").data, [])
        self.assertTrue(services.approve_clip(clip))
        self.assertFalse(services.approve_clip(clip))
        clip.refresh_from_db()
        self.assertEqual(clip.status, ClipStatus.PLAYING)
        self.assertIsNotNone(clip.paid_at)
        self.assertEqual(clip.ends_at - clip.starts_at, timedelta(hours=24))
        live = self.client.get("/api/v1/promotions/clips/live/")
        self.assertEqual([c["id"] for c in live.data], [clip.pk])

    def test_validation_codes(self):
        r = self.order(duration_seconds=31)
        self.assertEqual(r.data["codes"]["duration_seconds"], ["video_too_long"])
        r = self.order(video=video("clip.avi"))
        self.assertEqual(r.data["codes"]["video"], ["video_format"])
        r = self.order(video=video("clip.mp4", head=b"MZ\x90\x00not-a-video!"))  # extension trompeuse
        self.assertEqual(r.data["codes"]["video"], ["file_type"])
        self.assertEqual(self.order(video=video("clip.webm", head=WEBM_HEAD)).status_code, 201)
        Clip.objects.all().delete()
        Payment.objects.all().delete()
        with mock.patch("apps.promotions.serializers.CLIP_VIDEO_MAX_BYTES", 10):
            r = self.order()
        self.assertEqual(r.data["codes"]["video"], ["file_too_large"])
        self.assertFalse(Clip.objects.exists())

    def test_poster_is_checked_and_reencoded(self):
        from apps.accounts.tests.helpers import image_file
        r = self.order(poster=SimpleUploadedFile("affiche.png", b"GIF89a....", content_type="image/png"))
        self.assertEqual(r.status_code, 400)
        r = self.order(poster=image_file("affiche.jpeg"))  # contenu PNG sous une extension .jpeg
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(Clip.objects.get().poster.name.endswith(".png"))

    def test_throttled(self):
        with mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, {"clip_create": "1/hour"}):
            self.assertEqual(self.order().status_code, 201)
            self.assertEqual(self.order().status_code, 429)

    def test_logged_in_artist_is_attached(self):
        make_artist()
        self.auth(self.login().data["access"])
        r = self.order()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIsNotNone(Clip.objects.get().artist)


class ClipQueueTests(BaseTestCase):
    def test_at_most_50_playing_then_fifo(self):
        base = timezone.now() - timedelta(hours=1)
        clips = [make_clip(paid_at=base + timedelta(seconds=i)) for i in range(52)]
        self.assertEqual(services.refresh_queue(), 50)
        self.assertEqual(services.refresh_queue(), 0)  # idempotente
        self.assertEqual(Clip.objects.filter(status=ClipStatus.PLAYING).count(), 50)
        waiting = list(Clip.objects.filter(status=ClipStatus.QUEUED).order_by("paid_at"))
        self.assertEqual(waiting, clips[50:])
        self.assertEqual(services.queue_position(waiting[1]), 2)

        # 24 h plus tard, les 50 premiers se terminent et les 2 suivants passent
        later = timezone.now() + timedelta(hours=24, minutes=1)
        self.assertEqual(services.refresh_queue(now=later), 2)
        self.assertEqual(Clip.objects.filter(status=ClipStatus.FINISHED).count(), 50)
        self.assertEqual(set(Clip.objects.filter(status=ClipStatus.PLAYING)), set(clips[50:]))

    def test_rejecting_playing_clip_frees_slot(self):
        with mock.patch("apps.promotions.services.CLIP_SLOTS", 1):
            first = make_clip(paid_at=timezone.now() - timedelta(minutes=2))
            second = make_clip(paid_at=timezone.now() - timedelta(minutes=1))
            services.refresh_queue()
            services.reject_clip(first)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, ClipStatus.REJECTED)
        self.assertEqual(second.status, ClipStatus.PLAYING)

    def test_command(self):
        make_clip()
        call_command("refresh_clip_queue", stdout=mock.MagicMock())
        self.assertEqual(Clip.objects.get().status, ClipStatus.PLAYING)


class AdsAndTvTests(BaseTestCase):
    def test_ads_by_format(self):
        now = timezone.now()
        for i in range(4):
            AdCampaign.objects.create(advertiser=f"A{i}", format=AdFormat.BUTTON, image="ads/x.png")
        AdCampaign.objects.create(advertiser="Fini", format=AdFormat.BANNER, image="ads/x.png",
                                  ends_at=now - timedelta(days=1))
        AdCampaign.objects.create(advertiser="Inactif", format=AdFormat.BANNER, image="ads/x.png", is_active=False)
        self.assertEqual(len(self.client.get("/api/v1/promotions/ads/?format=button_88x31").data), 3)
        self.assertEqual(self.client.get("/api/v1/promotions/ads/?format=banner_468x60").data, [])
        r = self.client.get("/api/v1/promotions/ads/?format=nope")
        self.assertEqual(r.status_code, 400)

    def test_live_tv(self):
        now = timezone.now()
        LiveStream.objects.create(title="Direct", embed_url="https://example.com/live", starts_at=now, is_live=True)
        LiveStream.objects.create(title="Demain", embed_url="https://example.com/2", starts_at=now + timedelta(days=1))
        r = self.client.get("/api/v1/promotions/live-tv/")
        self.assertEqual(r.data["live"]["title"], "Direct")
        self.assertEqual([s["title"] for s in r.data["upcoming"]], ["Demain"])
