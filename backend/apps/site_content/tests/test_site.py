from unittest import mock

from django.core import mail
from django.test import override_settings

from apps.accounts.models import ArtistStatus
from apps.accounts.tests.helpers import BaseTestCase, make_artist
from apps.notifications import sms
from apps.site_content import services
from apps.site_content.models import Broadcast, BroadcastAudience, ContactMessage, NewsletterSubscriber, Page


class ContactTests(BaseTestCase):
    @override_settings(AGAPY_CONTACT_EMAIL="equipe@agapy.test")
    def test_contact_saved_emailed_and_throttled(self):
        data = {"name": "Awa", "email": "awa@exemple.com", "subject": "Question", "message": "Bonjour"}
        for _ in range(5):
            self.assertEqual(self.client.post("/api/v1/site/contact/", data, format="json").status_code, 201)
        self.assertEqual(self.client.post("/api/v1/site/contact/", data, format="json").status_code, 429)
        self.assertEqual(ContactMessage.objects.count(), 5)
        self.assertEqual(mail.outbox[0].to, ["equipe@agapy.test"])


class NewsletterTests(BaseTestCase):
    def test_subscribe_idempotent_and_unsubscribe(self):
        for _ in range(2):
            r = self.client.post("/api/v1/site/newsletter/", {"email": "Awa@Exemple.com", "language": "en"},
                                 format="json")
            self.assertEqual(r.status_code, 200)
        self.assertEqual(NewsletterSubscriber.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        token = services.unsubscribe_token("awa@exemple.com")
        r = self.client.post("/api/v1/site/newsletter/unsubscribe/", {"token": token}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(NewsletterSubscriber.objects.get().is_active)
        r = self.client.post("/api/v1/site/newsletter/unsubscribe/", {"token": "faux"}, format="json")
        self.assertEqual(r.data["codes"]["token"], ["invalid_token"])


class PagesAndStatsTests(BaseTestCase):
    def test_page_language_fallback(self):
        Page.objects.create(slug="terms", title_fr="Conditions", title_en="Terms", body_fr="Texte")
        r = self.client.get("/api/v1/site/pages/terms/?lang=en")
        self.assertEqual((r.data["title"], r.data["body"]), ("Terms", "Texte"))
        self.assertEqual(self.client.get("/api/v1/site/pages/nope/").status_code, 404)

    def test_artist_counter_floor(self):
        make_artist()
        self.assertEqual(self.client.get("/api/v1/site/stats/").data, {"artist_count": 1500})
        with mock.patch("apps.site_content.services.ARTIST_COUNTER_FLOOR", 0):
            self.assertEqual(services.artist_count(), 1)


class BroadcastTests(BaseTestCase):
    def test_send_once_to_audience(self):
        make_artist()
        make_artist(phone="+2250700000002", status=ArtistStatus.DORMANT)
        make_artist(phone="+2250700000003", status=ArtistStatus.EXCLUDED)
        b = Broadcast.objects.create(title="Info", message="Nouveauté", audience=BroadcastAudience.ALL)
        self.assertTrue(services.send_broadcast(b))
        self.assertFalse(services.send_broadcast(b))
        b.refresh_from_db()
        self.assertEqual(b.recipient_count, 2)
        self.assertEqual(len(sms.outbox), 2)
        self.assertEqual(len(mail.outbox), 2)
