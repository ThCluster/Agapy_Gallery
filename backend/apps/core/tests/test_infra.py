"""Durée réelle des médias et sonde de santé /healthz."""
import io
import json
import shutil
import struct
import wave
from unittest import mock

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings

from apps.core import uploads
from apps.core.uploads import check_media_duration, media_duration, rounded_seconds


def wav_file(seconds: float, name="son.wav") -> SimpleUploadedFile:
    buf = io.BytesIO()
    rate = 8000
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack("<h", 0) * int(rate * seconds))
    return SimpleUploadedFile(name, buf.getvalue(), content_type="audio/wav")


class MediaDurationTests(SimpleTestCase):
    def test_wav_measured_by_mutagen(self):
        f = wav_file(12.0)
        with mock.patch.object(uploads, "_ffprobe_duration") as ffprobe:
            self.assertAlmostEqual(media_duration(f), 12.0, places=1)
        ffprobe.assert_not_called()
        self.assertEqual(f.tell(), 0)  # fichier rembobiné

    def test_unknown_format_returns_none(self):
        f = SimpleUploadedFile("x.mp4", b"\x00\x00\x00\x18ftypmp42" + b"0" * 200)
        self.assertIsNone(media_duration(f))
        self.assertEqual(f.tell(), 0)

    def test_ffprobe_fallback_absent(self):
        f = SimpleUploadedFile("x.webm", b"\x1a\x45\xdf\xa3" + b"0" * 50)
        with mock.patch.object(uploads.shutil, "which", return_value=None):
            self.assertIsNone(media_duration(f))

    def test_ffprobe_fallback_used(self):
        f = SimpleUploadedFile("x.webm", b"\x1a\x45\xdf\xa3" + b"0" * 50)
        result = mock.Mock(returncode=0, stdout="27.400000\n")
        with mock.patch.object(uploads.shutil, "which", return_value="/usr/bin/ffprobe"), \
                mock.patch.object(uploads.subprocess, "run", return_value=result) as run:
            self.assertAlmostEqual(media_duration(f), 27.4)
        args = run.call_args.args[0]
        self.assertEqual(args[0], "/usr/bin/ffprobe")
        self.assertIn("-protocol_whitelist", args)
        self.assertEqual(run.call_args.kwargs["timeout"], uploads.FFPROBE_TIMEOUT)

    @override_settings(MEDIA_FFPROBE_ENABLED=False)
    def test_ffprobe_can_be_disabled(self):
        with mock.patch.object(uploads.shutil, "which") as which:
            self.assertIsNone(media_duration(SimpleUploadedFile("x.webm", b"\x1a\x45\xdf\xa3")))
        which.assert_not_called()

    def test_real_ffprobe_if_installed(self):
        if not shutil.which("ffprobe"):
            self.skipTest("ffprobe absent")
        with mock.patch.object(uploads, "_mutagen_duration", return_value=None):
            self.assertAlmostEqual(media_duration(wav_file(3.0)), 3.0, places=1)

    def test_check_media_duration(self):
        self.assertAlmostEqual(check_media_duration(wav_file(30.4), 30), 30.4, places=1)  # tolérance 0,5 s
        with self.assertRaises(ValidationError) as ctx:
            check_media_duration(wav_file(31.0), 30, code="excerpt_too_long")
        self.assertEqual(ctx.exception.code, "excerpt_too_long")
        self.assertEqual(rounded_seconds(30.4, 30), 30)
        self.assertEqual(rounded_seconds(0.2, 30), 1)


class HealthzTests(TestCase):
    def test_ok_without_authentication(self):
        r = self.client.get("/healthz")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(json.loads(r.content), {"status": "ok", "checks": {"database": "ok", "cache": "ok"}})
        self.assertIn("no-cache", r["Cache-Control"])

    def test_database_down(self):
        with mock.patch.object(connection, "cursor", side_effect=RuntimeError("mot de passe : secret")), \
                self.assertLogs("agapy.health", "ERROR"):
            r = self.client.get("/healthz")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(json.loads(r.content)["checks"], {"database": "error", "cache": "ok"})
        self.assertNotContains(r, "secret", status_code=503)

    def test_post_refused(self):
        self.assertEqual(self.client.post("/healthz").status_code, 405)
