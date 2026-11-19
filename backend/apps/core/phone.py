"""
Numéros de téléphone : ils servent d'identifiant de connexion (un numéro = un compte).

Ils sont toujours stockés au format international E.164 (ex. +2250700000000), pour que
« 07 00 00 00 00 » saisi avec le pays CI et « +225 07 00 00 00 00 » désignent le même compte.
"""
import phonenumbers
from django.core.exceptions import ValidationError


def normalize_phone(raw: str, country: str | None = None) -> str:
    """Renvoie le numéro au format E.164, ou lève ValidationError (code "phone_invalid")."""
    raw = (raw or "").strip()
    region = (country or "").upper() or None
    try:
        number = phonenumbers.parse(raw, None if raw.startswith("+") else region)
    except phonenumbers.NumberParseException:
        raise ValidationError("Numéro de téléphone invalide.", code="phone_invalid")
    if not phonenumbers.is_valid_number(number):
        raise ValidationError("Numéro de téléphone invalide.", code="phone_invalid")
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def phone_region(e164: str) -> str | None:
    """Pays d'un numéro E.164 (ex. « CI » pour +225…)."""
    try:
        return phonenumbers.region_code_for_number(phonenumbers.parse(e164, None))
    except phonenumbers.NumberParseException:
        return None


def format_international(e164: str) -> str:
    """Affichage lisible, ex. « +225 07 00 00 00 00 »."""
    try:
        number = phonenumbers.parse(e164, None)
    except phonenumbers.NumberParseException:
        return e164
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
