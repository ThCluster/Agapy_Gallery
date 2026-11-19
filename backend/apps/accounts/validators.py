import re

from django.core.exceptions import ValidationError

# Cahier des charges : 8 à 12 caractères, lettres et chiffres mélangés.
# Miroir de PASSWORD_RULE dans frontend/src/features/auth/loginSchema.ts.
PASSWORD_RULE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,12}$")

GPS_RULE = re.compile(r"^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$")


class AgapyPasswordValidator:
    """Validateur branché dans AUTH_PASSWORD_VALIDATORS."""

    def validate(self, password, user=None):
        if not PASSWORD_RULE.match(password or ""):
            raise ValidationError(
                "Le mot de passe doit contenir 8 à 12 caractères, avec des lettres et des chiffres.",
                code="password_format",
            )

    def get_help_text(self):
        return "8 à 12 caractères, lettres et chiffres."


def normalize_iban(value: str) -> str:
    return re.sub(r"\s+", "", value or "").upper()


def validate_iban(value: str) -> None:
    """Vérifie la clé de contrôle de l'IBAN (modulo 97), comme isValidIban() du frontend."""
    s = normalize_iban(value)
    if not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{10,30}", s):
        raise ValidationError("IBAN invalide.", code="iban_invalid")
    digits = "".join(str(int(c, 36)) for c in s[4:] + s[:4])
    if int(digits) % 97 != 1:
        raise ValidationError("IBAN invalide.", code="iban_invalid")


def validate_gps(value: str) -> None:
    if value and not GPS_RULE.match(value):
        raise ValidationError("Coordonnées GPS invalides (ex. 5.3364, -4.0267).", code="gps_invalid")
