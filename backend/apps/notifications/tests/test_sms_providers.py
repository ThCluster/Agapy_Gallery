"""Fournisseurs SMS réels testés avec un faux serveur (urllib.request.urlopen simulé) : aucun appel réseau."""
import base64
import io
import json
import urllib.error
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from apps.notifications import sms_providers
from apps.notifications.sms_providers import HttpSmsBackend, OrangeSmsBackend, SmsError, TwilioSmsBackend


class FakeResponse(io.BytesIO):
    def __init__(self, data=b"", status=200):
        super().__init__(json.dumps(data).encode() if isinstance(data, dict) else data)
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


class FakeServer:
    """Enregistre les requêtes et renvoie les réponses prévues, dans l'ordre."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []

    def __call__(self, req, timeout=None):
        self.requests.append({"url": req.full_url, "data": req.data, "headers": dict(req.header_items()),
                              "method": req.get_method(), "timeout": timeout})
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def http_error(code):
    return urllib.error.HTTPError("https://x", code, "err", {}, io.BytesIO(b'{"secret": "x"}'))


ORANGE = dict(SMS_ORANGE_CLIENT_ID="cid", SMS_ORANGE_CLIENT_SECRET="csecret", SMS_ORANGE_SENDER="2250000000000",
              SMS_ORANGE_SENDER_NAME="AGAPY")


@override_settings(**ORANGE)
class OrangeTests(SimpleTestCase):
    def setUp(self):
        OrangeSmsBackend.clear_token_cache()

    def run_with(self, server):
        with mock.patch.object(sms_providers.urllib.request, "urlopen", server):
            OrangeSmsBackend().send("+2250501020304", "Votre code est 123456")

    def test_token_then_send(self):
        server = FakeServer(FakeResponse({"access_token": "tok", "expires_in": 3600}), FakeResponse({}, 201))
        with self.assertLogs("agapy.sms", "INFO") as logs:
            self.run_with(server)
        token_req, send_req = server.requests
        self.assertEqual(token_req["url"], "https://api.orange.com/oauth/v3/token")
        self.assertEqual(token_req["data"], b"grant_type=client_credentials")
        self.assertEqual(token_req["headers"]["Authorization"], "Basic " + base64.b64encode(b"cid:csecret").decode())
        self.assertEqual(send_req["url"],
                         "https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B2250000000000/requests")
        self.assertEqual(send_req["headers"]["Authorization"], "Bearer tok")
        self.assertEqual(send_req["timeout"], 10)
        body = json.loads(send_req["data"])["outboundSMSMessageRequest"]
        self.assertEqual(body["address"], "tel:+2250501020304")
        self.assertEqual(body["senderAddress"], "tel:+2250000000000")
        self.assertEqual(body["senderName"], "AGAPY")
        self.assertEqual(body["outboundSMSTextMessage"]["message"], "Votre code est 123456")
        # Ni le contenu ni le numéro complet dans les journaux
        joined = "\n".join(logs.output)
        self.assertNotIn("123456", joined)
        self.assertNotIn("0501020304", joined)

    def test_token_is_cached(self):
        server = FakeServer(FakeResponse({"access_token": "tok", "expires_in": 3600}), FakeResponse({}, 201),
                            FakeResponse({}, 201))
        self.run_with(server)
        self.run_with(server)
        self.assertEqual(len(server.requests), 3)  # un seul jeton pour deux SMS

    def test_expired_token_is_renewed(self):
        server = FakeServer(FakeResponse({"access_token": "t1", "expires_in": 30}), FakeResponse({}, 201),
                            FakeResponse({"access_token": "t2", "expires_in": 3600}), FakeResponse({}, 201))
        self.run_with(server)  # 30 s - marge de 60 s : déjà expiré
        self.run_with(server)
        self.assertEqual(server.requests[3]["headers"]["Authorization"], "Bearer t2")

    def test_401_renews_token_once(self):
        server = FakeServer(FakeResponse({"access_token": "t1", "expires_in": 3600}), http_error(401),
                            FakeResponse({"access_token": "t2", "expires_in": 3600}), FakeResponse({}, 201))
        self.run_with(server)
        self.assertEqual(len(server.requests), 4)

    def test_errors_are_clear_and_without_content(self):
        server = FakeServer(FakeResponse({"access_token": "tok", "expires_in": 3600}), http_error(400))
        with self.assertRaises(SmsError) as ctx:
            self.run_with(server)
        self.assertIn("HTTP 400", str(ctx.exception))
        self.assertNotIn("123456", str(ctx.exception))

    def test_unreachable(self):
        server = FakeServer(urllib.error.URLError(TimeoutError("timed out")))
        with self.assertRaises(SmsError) as ctx:
            self.run_with(server)
        self.assertIn("injoignable", str(ctx.exception))

    @override_settings(SMS_ORANGE_CLIENT_ID=None)
    def test_missing_setting(self):
        with self.assertRaises(ImproperlyConfigured):
            OrangeSmsBackend()


@override_settings(SMS_TWILIO_SID="AC123", SMS_TWILIO_TOKEN="tok", SMS_TWILIO_FROM="+15550000000")
class TwilioTests(SimpleTestCase):
    def test_send(self):
        server = FakeServer(FakeResponse({"sid": "SM1", "status": "queued"}, 201))
        with mock.patch.object(sms_providers.urllib.request, "urlopen", server):
            TwilioSmsBackend().send("2250501020304", "Bonjour")
        req = server.requests[0]
        self.assertEqual(req["url"], "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json")
        self.assertEqual(req["headers"]["Authorization"], "Basic " + base64.b64encode(b"AC123:tok").decode())
        self.assertIn(b"To=%2B2250501020304", req["data"])
        self.assertIn(b"From=%2B15550000000", req["data"])
        self.assertIn(b"Body=Bonjour", req["data"])

    def test_http_error(self):
        server = FakeServer(http_error(401))
        with mock.patch.object(sms_providers.urllib.request, "urlopen", server), self.assertRaises(SmsError):
            TwilioSmsBackend().send("+2250501020304", "Bonjour")


@override_settings(SMS_HTTP_URL="https://sms.exemple.ci/send", SMS_HTTP_HEADERS='{"X-Api-Key": "k"}',
                   SMS_HTTP_TEMPLATE='{"dest": ["{to}"], "text": "{message}", "meta": {"from": "{sender}"}}',
                   SMS_HTTP_SENDER="AGAPY")
class HttpBackendTests(SimpleTestCase):
    def test_send_with_template(self):
        server = FakeServer(FakeResponse(b"OK"))
        with mock.patch.object(sms_providers.urllib.request, "urlopen", server):
            HttpSmsBackend().send("+2250501020304", 'Code "{sender}" 42')
        req = server.requests[0]
        self.assertEqual(req["url"], "https://sms.exemple.ci/send")
        self.assertEqual(req["headers"]["X-api-key"], "k")
        self.assertEqual(json.loads(req["data"]),
                         {"dest": ["+2250501020304"], "text": 'Code "{sender}" 42', "meta": {"from": "AGAPY"}})

    @override_settings(SMS_HTTP_TEMPLATE="{pas du json")
    def test_bad_template(self):
        with self.assertRaises(ImproperlyConfigured):
            HttpSmsBackend()

    def test_server_error(self):
        server = FakeServer(http_error(503))
        with mock.patch.object(sms_providers.urllib.request, "urlopen", server), self.assertRaises(SmsError):
            HttpSmsBackend().send("+2250501020304", "x")
