"""
Fournisseurs SMS réels, prêts à l'emploi (aucun n'est encore choisi).

Pour en activer un, déclarez-le dans SMS_BACKEND (fichier .env) et renseignez ses réglages :

- Orange SMS API (Afrique de l'Ouest) : SMS_BACKEND=apps.notifications.sms_providers.OrangeSmsBackend
  SMS_ORANGE_CLIENT_ID, SMS_ORANGE_CLIENT_SECRET, SMS_ORANGE_SENDER (numéro de l'expéditeur, ex. 2250000000000)
  et, si besoin, SMS_ORANGE_SENDER_NAME (nom affiché, sinon SMS_SENDER_NAME).
- Twilio : SMS_BACKEND=apps.notifications.sms_providers.TwilioSmsBackend
  SMS_TWILIO_SID, SMS_TWILIO_TOKEN, SMS_TWILIO_FROM (numéro ou identifiant d'expéditeur).
- Agrégateur local (API HTTP JSON) : SMS_BACKEND=apps.notifications.sms_providers.HttpSmsBackend
  SMS_HTTP_URL, SMS_HTTP_HEADERS (JSON), SMS_HTTP_TEMPLATE (JSON avec {to}, {message}, {sender}).

Aucune dépendance externe (urllib.request). Les journaux ne contiennent jamais le texte du SMS
(identifiants, codes) ni le numéro complet : seulement le numéro masqué et le code HTTP.
"""
import base64
import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .sms import BaseSmsBackend, mask_phone

logger = logging.getLogger("agapy.sms")

DEFAULT_TIMEOUT = 10  # secondes


class SmsError(Exception):
    """Échec de l'envoi d'un SMS par le fournisseur (message sans contenu sensible)."""


def _setting(name, default=None):
    return getattr(settings, name, default)


def _require(name):
    value = _setting(name)
    if not value:
        raise ImproperlyConfigured(f"Le réglage {name} est requis par le fournisseur SMS choisi.")
    return value


def _http(url, *, data: bytes, headers: dict, timeout: float, provider: str) -> dict:
    """Requête POST ; renvoie le JSON de la réponse (ou {}). Lève SmsError sans détail sensible."""
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (URL fixée par la configuration)
            status = getattr(resp, "status", 200)
            body = resp.read()
    except urllib.error.HTTPError as exc:
        raise SmsError(f"{provider} : réponse HTTP {exc.code}.") from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        reason = getattr(exc, "reason", exc)
        raise SmsError(f"{provider} : service injoignable ({type(reason).__name__}).") from None
    if not 200 <= status < 300:
        raise SmsError(f"{provider} : réponse HTTP {status}.")
    if not body:
        return {}
    try:
        return json.loads(body)
    except ValueError:
        return {}


def _e164(to: str) -> str:
    to = (to or "").strip().replace(" ", "")
    if not to:
        raise SmsError("Numéro de destinataire vide.")
    return to if to.startswith("+") else "+" + to


# ---------------------------------------------------------------------------
# Orange SMS API
# ---------------------------------------------------------------------------
class OrangeSmsBackend(BaseSmsBackend):
    """
    API Orange SMS (Côte d'Ivoire, Sénégal, Mali…) : jeton OAuth2 « client_credentials »
    gardé en mémoire jusqu'à son expiration (moins une marge), puis envoi du message.
    """

    TOKEN_URL = "https://api.orange.com/oauth/v3/token"
    SEND_URL = "https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B{sender}/requests"
    TOKEN_MARGIN = 60  # secondes retirées à la durée de vie annoncée

    # Jeton partagé par toutes les instances du processus : {"token", "expires_at"}
    _token_cache: dict = {}
    _lock = threading.Lock()

    def __init__(self):
        self.client_id = _require("SMS_ORANGE_CLIENT_ID")
        self.client_secret = _require("SMS_ORANGE_CLIENT_SECRET")
        self.sender = str(_require("SMS_ORANGE_SENDER")).lstrip("+")
        self.sender_name = _setting("SMS_ORANGE_SENDER_NAME") or _setting("SMS_SENDER_NAME")
        self.timeout = _setting("SMS_TIMEOUT", DEFAULT_TIMEOUT)

    @classmethod
    def clear_token_cache(cls):
        with cls._lock:
            cls._token_cache.clear()

    def get_token(self) -> str:
        with self._lock:
            cached = self._token_cache
            if cached.get("token") and cached.get("client_id") == self.client_id \
                    and cached.get("expires_at", 0) > time.monotonic():
                return cached["token"]
            basic = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
            data = _http(
                self.TOKEN_URL,
                data=urllib.parse.urlencode({"grant_type": "client_credentials"}).encode(),
                headers={"Authorization": f"Basic {basic}", "Accept": "application/json",
                         "Content-Type": "application/x-www-form-urlencoded"},
                timeout=self.timeout, provider="Orange (jeton)",
            )
            token = data.get("access_token")
            if not token:
                raise SmsError("Orange (jeton) : réponse sans access_token.")
            try:
                lifetime = int(data.get("expires_in", 3600))
            except (TypeError, ValueError):
                lifetime = 3600
            self._token_cache.update({
                "token": token, "client_id": self.client_id,
                "expires_at": time.monotonic() + max(lifetime - self.TOKEN_MARGIN, 0),
            })
            return token

    def send(self, to: str, message: str) -> None:
        to = _e164(to)
        payload = {"outboundSMSMessageRequest": {
            "address": f"tel:{to}",
            "senderAddress": f"tel:+{self.sender}",
            "outboundSMSTextMessage": {"message": message},
        }}
        if self.sender_name:
            payload["outboundSMSMessageRequest"]["senderName"] = self.sender_name
        body = json.dumps(payload).encode()
        url = self.SEND_URL.format(sender=self.sender)
        for attempt in (1, 2):
            headers = {"Authorization": f"Bearer {self.get_token()}", "Content-Type": "application/json",
                       "Accept": "application/json"}
            try:
                _http(url, data=body, headers=headers, timeout=self.timeout, provider="Orange")
                break
            except SmsError as exc:
                # Jeton révoqué avant son expiration : on en redemande un, une seule fois
                if attempt == 1 and "HTTP 401" in str(exc):
                    self.clear_token_cache()
                    continue
                raise
        logger.info("SMS envoyé par Orange à %s (%d caractères)", mask_phone(to), len(message))


# ---------------------------------------------------------------------------
# Twilio
# ---------------------------------------------------------------------------
class TwilioSmsBackend(BaseSmsBackend):
    """API REST Twilio « Messages » (authentification Basic SID:jeton)."""

    SEND_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

    def __init__(self):
        self.sid = _require("SMS_TWILIO_SID")
        self.token = _require("SMS_TWILIO_TOKEN")
        self.sender = _require("SMS_TWILIO_FROM")
        self.timeout = _setting("SMS_TIMEOUT", DEFAULT_TIMEOUT)

    def send(self, to: str, message: str) -> None:
        to = _e164(to)
        basic = base64.b64encode(f"{self.sid}:{self.token}".encode()).decode()
        data = _http(
            self.SEND_URL.format(sid=urllib.parse.quote(self.sid, safe="")),
            data=urllib.parse.urlencode({"To": to, "From": self.sender, "Body": message}).encode(),
            headers={"Authorization": f"Basic {basic}", "Accept": "application/json",
                     "Content-Type": "application/x-www-form-urlencoded"},
            timeout=self.timeout, provider="Twilio",
        )
        if data.get("error_code"):
            raise SmsError(f"Twilio : erreur {data['error_code']}.")
        logger.info("SMS envoyé par Twilio à %s (%d caractères)", mask_phone(to), len(message))


# ---------------------------------------------------------------------------
# Agrégateur HTTP générique
# ---------------------------------------------------------------------------
def _fill(template, values: dict):
    """Remplace {to}, {message}, {sender} dans toutes les chaînes du gabarit JSON (sans format() : pas d'injection)."""
    if isinstance(template, str):
        if template in {"{to}", "{message}", "{sender}"}:
            return values[template[1:-1]]
        out = template
        for key, value in values.items():
            out = out.replace("{" + key + "}", str(value))
        return out
    if isinstance(template, dict):
        return {k: _fill(v, values) for k, v in template.items()}
    if isinstance(template, list):
        return [_fill(v, values) for v in template]
    return template


class HttpSmsBackend(BaseSmsBackend):
    """
    Agrégateur SMS local exposant une API HTTP JSON.

    SMS_HTTP_URL       adresse de l'API (https://…)
    SMS_HTTP_HEADERS   en-têtes JSON, ex. {"Authorization": "Bearer xxx"}
    SMS_HTTP_TEMPLATE  corps JSON, ex. {"to": "{to}", "text": "{message}", "from": "{sender}"}
    SMS_HTTP_SENDER    expéditeur (sinon SMS_SENDER_NAME)
    """

    DEFAULT_TEMPLATE = {"to": "{to}", "message": "{message}", "sender": "{sender}"}

    def __init__(self):
        self.url = _require("SMS_HTTP_URL")
        self.headers = self._json_setting("SMS_HTTP_HEADERS", {})
        self.template = self._json_setting("SMS_HTTP_TEMPLATE", self.DEFAULT_TEMPLATE)
        self.sender = _setting("SMS_HTTP_SENDER") or _setting("SMS_SENDER_NAME", "")
        self.timeout = _setting("SMS_TIMEOUT", DEFAULT_TIMEOUT)

    @staticmethod
    def _json_setting(name, default):
        value = _setting(name)
        if not value:
            return default
        if isinstance(value, (dict, list)):
            return value
        try:
            return json.loads(value)
        except ValueError:
            raise ImproperlyConfigured(f"{name} doit être un JSON valide.") from None

    def send(self, to: str, message: str) -> None:
        to = _e164(to)
        body = _fill(self.template, {"to": to, "message": message, "sender": self.sender})
        headers = {"Content-Type": "application/json", "Accept": "application/json", **self.headers}
        _http(self.url, data=json.dumps(body).encode(), headers=headers, timeout=self.timeout,
              provider="Agrégateur SMS")
        logger.info("SMS envoyé par l'agrégateur à %s (%d caractères)", mask_phone(to), len(message))
