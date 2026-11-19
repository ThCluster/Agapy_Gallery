"""Durée réelle de la vidéo d'un clip : mesurée (mutagen / ffprobe), elle prime sur la durée déclarée."""
import shutil
import tempfile
from unittest import mock

from django.test import override_settings
from rest_framework.throttling import SimpleRateThrottle

from apps.accounts.tests.helpers import BaseTestCase
from apps.promotions.models import Clip

from .test_clips import video

MEDIA = tempfile.mkdtemp(prefix="agapy-promo-duree-")


@override_settings(MEDIA_ROOT=MEDIA)
class ClipDurationTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, {"clip_create": "1000/hour"})
        patcher.start()
        self.addCleanup(patcher.stop)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def order(self, measured, declared=20):
        data = {"title": "Vernissage", "advertiser": "Galerie X", "contact_phone": "+2250700000001",
                "video": video(), "duration_seconds": declared, "method": "momo"}
        with mock.patch("apps.core.uploads.media_duration", return_value=measured):
            return self.client.post("/api/v1/promotions/clips/", data, format="multipart")

    def test_measured_too_long(self):
        r = self.order(measured=45.2)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["video"], ["video_too_long"])
        self.assertFalse(Clip.objects.exists())

    def test_measured_replaces_declared(self):
        r = self.order(measured=30.4, declared=10)  # 0,5 s de tolérance
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Clip.objects.get().duration_seconds, 30)

    def test_unknown_duration_keeps_declared(self):
        r = self.order(measured=None, declared=17)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Clip.objects.get().duration_seconds, 17)
