"""
Empreintes des coordonnées d'un artiste (e-mail, IBAN, mobile money).

Elles servent à reconnaître un artiste exclu ou sur liste rouge qui se réinscrit avec un autre
numéro de téléphone (cahier des charges p. 13), sans pouvoir rechercher les valeurs elles-mêmes,
chiffrées en base (apps.core.fields). HMAC-SHA256 avec une clé serveur : sans la clé, une empreinte
ne permet pas de retrouver la valeur, même pour un numéro de téléphone (espace de recherche réduit).

Clé : settings.FINGERPRINT_KEY si elle existe, sinon dérivée de SECRET_KEY. Changer la clé rend
les empreintes existantes inutilisables : relancer alors `recompute_fingerprints` (migration 0003).

Module sans dépendance aux modèles : il est aussi utilisé par les migrations de données.
"""
import hashlib
import hmac
import re

from django.conf import settings

from .validators import normalize_iban

GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}


def _key() -> bytes:
    secret = getattr(settings, "FINGERPRINT_KEY", None) or settings.SECRET_KEY
    return hashlib.sha256(b"agapy.accounts.fingerprint:" + secret.encode()).digest()


def _hmac(kind: str, value: str) -> str:
    if not value:
        return ""
    return hmac.new(_key(), f"{kind}:{value}".encode(), hashlib.sha256).hexdigest()


def normalize_email(value: str) -> str:
    """Minuscules, sans « +étiquette » ; sans les points pour Gmail (mêmes boîtes aux lettres)."""
    value = (value or "").strip().lower()
    if "@" not in value:
        return value
    local, domain = value.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if domain in GMAIL_DOMAINS:
        local, domain = local.replace(".", ""), "gmail.com"
    return f"{local}@{domain}"


def normalize_number(value: str) -> str:
    """Numéro déjà au format E.164 en base : on ne garde que « + » et les chiffres."""
    return re.sub(r"[^\d+]", "", value or "")


def email_fingerprint(value: str) -> str:
    return _hmac("email", normalize_email(value))


def iban_fingerprint(value: str) -> str:
    return _hmac("iban", normalize_iban(value))


def number_fingerprint(value: str) -> str:
    """Numéro de téléphone ou de mobile money (même espace : un numéro de connexion peut servir de momo)."""
    return _hmac("phone", normalize_number(value))


def compute(email: str, iban: str, momo_number: str, phone: str = "") -> dict:
    return {
        "email_fingerprint": email_fingerprint(email),
        "iban_fingerprint": iban_fingerprint(iban),
        "momo_fingerprint": number_fingerprint(momo_number),
        "phone_fingerprint": number_fingerprint(phone),
    }
