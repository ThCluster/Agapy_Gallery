"""Envoi différé (NOTIFICATIONS_ASYNC) : mise en file chiffrée, 3 essais, délai progressif."""
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.notifications import services, sms
from apps.notifications.models import Channel, OutboundMessage, OutboundStatus

LOCMEM = dict(SMS_BACKEND="apps.notifications.sms.LocmemSmsBackend",
              EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")


@override_settings(NOTIFICATIONS_ASYNC=False, **LOCMEM)
class SyncModeTests(TestCase):
    def setUp(self):
        sms.outbox.clear()

    def test_sync_sends_immediately(self):
        self.assertTrue(services.send_sms("+2250501020304", "Bonjour"))
        self.assertTrue(services.send_email("a@exemple.com", "Sujet", "Corps"))
        self.assertEqual(len(sms.outbox), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertFalse(OutboundMessage.objects.exists())


@override_settings(NOTIFICATIONS_ASYNC=True, **LOCMEM)
class AsyncModeTests(TestCase):
    def setUp(self):
        sms.outbox.clear()

    def run_command(self):
        out = StringIO()
        call_command("send_pending_notifications", stdout=out)
        return out.getvalue()

    def test_queued_encrypted_then_sent(self):
        self.assertTrue(services.send_sms("+2250501020304", "Votre mot de passe : ARTS2026"))
        self.assertTrue(services.send_email("jean@exemple.com", "Sujet", "Corps secret"))
        self.assertEqual(sms.outbox, [])
        self.assertEqual(mail.outbox, [])
        sms_msg = OutboundMessage.objects.get(channel=Channel.SMS)
        self.assertEqual(sms_msg.recipient_hint, "+225…04")
        self.assertNotIn("ARTS2026", sms_msg.payload)
        self.assertNotIn("0501020304", sms_msg.payload)
        self.assertEqual(OutboundMessage.objects.get(channel=Channel.EMAIL).recipient_hint, "j…@exemple.com")

        self.assertIn("2 envoyé(s)", self.run_command())
        self.assertEqual(sms.outbox, [{"to": "+2250501020304", "message": "Votre mot de passe : ARTS2026"}])
        self.assertEqual(mail.outbox[0].to, ["jean@exemple.com"])
        for msg in OutboundMessage.objects.all():
            self.assertEqual(msg.status, OutboundStatus.SENT)
            self.assertEqual(msg.payload, "")  # contenu effacé après l'envoi
            self.assertEqual(msg.attempts, 1)
        self.assertIn("0 envoyé(s)", self.run_command())  # rien n'est renvoyé

    def test_three_attempts_with_backoff(self):
        services.send_sms("+2250501020304", "x")
        msg = OutboundMessage.objects.get()
        with mock.patch.object(services, "deliver_sms", side_effect=RuntimeError("panne : x")):
            self.run_command()
            msg.refresh_from_db()
            self.assertEqual((msg.status, msg.attempts, msg.last_error), (OutboundStatus.PENDING, 1, "RuntimeError"))
            self.assertGreater(msg.next_attempt_at, timezone.now() + timedelta(seconds=50))

            self.run_command()  # trop tôt : rien
            msg.refresh_from_db()
            self.assertEqual(msg.attempts, 1)

            OutboundMessage.objects.update(next_attempt_at=timezone.now())
            self.run_command()
            msg.refresh_from_db()
            self.assertEqual(msg.attempts, 2)
            self.assertGreater(msg.next_attempt_at, timezone.now() + timedelta(minutes=4))

            OutboundMessage.objects.update(next_attempt_at=timezone.now())
            out = self.run_command()
        msg.refresh_from_db()
        self.assertIn("1 abandonné(s)", out)
        self.assertEqual((msg.status, msg.attempts, msg.payload), (OutboundStatus.FAILED, 3, ""))

    def test_retry_succeeds(self):
        services.send_email("a@exemple.com", "S", "B")
        with mock.patch.object(services, "deliver_email", side_effect=OSError):
            self.run_command()
        OutboundMessage.objects.update(next_attempt_at=timezone.now())
        self.run_command()
        msg = OutboundMessage.objects.get()
        self.assertEqual((msg.status, msg.attempts), (OutboundStatus.SENT, 2))
        self.assertEqual(len(mail.outbox), 1)

    def test_unreadable_payload_is_abandoned(self):
        OutboundMessage.objects.create(channel=Channel.SMS, recipient_hint="+225…04", payload="gAAAAAcorrompu")
        self.run_command()
        msg = OutboundMessage.objects.get()
        self.assertEqual(msg.status, OutboundStatus.FAILED)

    def test_enqueue_failure_falls_back_to_sync(self):
        with mock.patch.object(OutboundMessage, "set_content", side_effect=RuntimeError):
            self.assertTrue(services.send_sms("+2250501020304", "x"))
        self.assertEqual(len(sms.outbox), 1)

    def test_purge(self):
        services.send_sms("+2250501020304", "x")
        self.run_command()
        OutboundMessage.objects.update(created_at=timezone.now() - timedelta(days=31))
        self.assertIn("1 ancienne(s)", self.run_command())
        self.assertFalse(OutboundMessage.objects.exists())

    def test_admin_is_read_only_without_content(self):
        services.send_sms("+2250501020304", "Votre code : 987654")
        admin = get_user_model().objects.create_superuser(phone="+2250700000001", password="Admin2026")
        self.client.force_login(admin)
        msg = OutboundMessage.objects.get()
        r = self.client.get(reverse("admin:notifications_outboundmessage_change", args=[msg.pk]))
        self.assertEqual(r.status_code, 200)
        self.assertNotContains(r, msg.payload)
        self.assertNotContains(r, "987654")
        self.assertNotContains(r, 'name="_save"')
        r = self.client.get(reverse("admin:notifications_outboundmessage_add"))
        self.assertEqual(r.status_code, 403)
