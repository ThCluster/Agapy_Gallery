"""
Champs chiffrés au repos (coordonnées bancaires et mobile money).

La valeur est chiffrée avec Fernet (AES-128-CBC + HMAC-SHA256, bibliothèque `cryptography`)
avant l'écriture en base et déchiffrée à la lecture : le code Python manipule toujours la valeur
en clair. Conséquences :

- une recherche ou un filtre sur la valeur (`iban="FR76…"`) ne trouve rien, le chiffrement étant
  aléatoire : utiliser des empreintes (voir apps.accounts.fingerprints) ;
- la colonne est de type texte (le chiffré est plus long que la valeur) ; `max_length` limite la
  valeur en clair, comme pour un CharField.

Clé : settings.FIELD_ENCRYPTION_KEY, une clé Fernet (32 octets en base64 urlsafe), générée par
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
Rotation : plusieurs clés séparées par des virgules, la première chiffre, toutes déchiffrent.
Sans clé : en DEBUG, une clé est dérivée de SECRET_KEY (avertissement) ; sinon ImproperlyConfigured.
"""
import base64
import functools
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models

logger = logging.getLogger("agapy.core")

# Tous les jetons Fernet commencent par l'octet de version 0x80, soit « gAAAAA » en base64.
TOKEN_PREFIX = "gAAAAA"

# Valeur de DEBUG configurée au démarrage : le lanceur de tests de Django force ensuite
# settings.DEBUG à False, ce qui empêcherait la clé de développement pendant les tests.
_DEBUG_AT_STARTUP = bool(settings.DEBUG)


@functools.lru_cache(maxsize=4)
def _build_fernet(keys: tuple[str, ...]) -> MultiFernet:
    try:
        return MultiFernet([Fernet(k.encode() if isinstance(k, str) else k) for k in keys])
    except (ValueError, TypeError) as e:
        raise ImproperlyConfigured(
            "FIELD_ENCRYPTION_KEY invalide : clé Fernet attendue (32 octets en base64 urlsafe)."
        ) from e


@functools.lru_cache(maxsize=1)
def _dev_key(secret_key: str) -> str:
    logger.warning(
        "FIELD_ENCRYPTION_KEY absente : clé de chiffrement dérivée de SECRET_KEY (développement "
        "uniquement). Définissez FIELD_ENCRYPTION_KEY avant toute mise en production."
    )
    digest = hashlib.sha256(b"agapy.field-encryption:" + secret_key.encode()).digest()
    return base64.urlsafe_b64encode(digest).decode()


def get_fernet() -> MultiFernet:
    raw = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
    if isinstance(raw, (list, tuple)):
        keys = tuple(k for k in raw if k)
    else:
        keys = tuple(k.strip() for k in (raw or "").split(",") if k.strip())
    if not keys:
        if not (settings.DEBUG or _DEBUG_AT_STARTUP):
            raise ImproperlyConfigured(
                "FIELD_ENCRYPTION_KEY doit être définie hors DEBUG (chiffrement des coordonnées bancaires)."
            )
        keys = (_dev_key(settings.SECRET_KEY),)
    return _build_fernet(keys)


def encrypt_str(value: str) -> str:
    return get_fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_str(token: str) -> str:
    try:
        return get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as e:
        raise ImproperlyConfigured(
            "Impossible de déchiffrer une valeur : FIELD_ENCRYPTION_KEY ne correspond pas à la clé utilisée."
        ) from e


def is_encrypted(value) -> bool:
    return isinstance(value, str) and value.startswith(TOKEN_PREFIX)


class EncryptedCharField(models.CharField):
    """
    CharField chiffré au repos. La chaîne vide reste vide en base (les filtres `champ=""` marchent).
    Une valeur non chiffrée déjà présente en base (données antérieures à la migration de
    chiffrement) est lue telle quelle et sera chiffrée au prochain enregistrement.
    """

    description = "Texte chiffré (Fernet)"

    def get_internal_type(self):
        # Colonne texte sans longueur : max_length s'applique à la valeur en clair
        return "TextField"

    def from_db_value(self, value, expression, connection):
        if value is None or value == "":
            return value
        if is_encrypted(value):
            return decrypt_str(value)
        return value

    def to_python(self, value):
        value = super().to_python(value)
        if is_encrypted(value):
            return decrypt_str(value)
        return value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None or value == "" or is_encrypted(value):
            return value
        return encrypt_str(str(value))


# ---------------------------------------------------------------------------
# Migrations de données : chiffrer / déchiffrer les valeurs déjà en base (SQL brut, par lots)
# ---------------------------------------------------------------------------
def _convert_column(model, field_names, schema_editor, convert):
    """`convert(valeur)` renvoie la nouvelle valeur, ou None pour la laisser telle quelle."""
    connection = schema_editor.connection
    qn = connection.ops.quote_name
    table = qn(model._meta.db_table)
    pk = qn(model._meta.pk.column)
    columns = [model._meta.get_field(name).column for name in field_names]
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {pk}, {', '.join(qn(c) for c in columns)} FROM {table}")
        rows = cursor.fetchall()
    with connection.cursor() as cursor:
        for row_pk, *values in rows:
            updates = {}
            for column, value in zip(columns, values):
                new = convert(value) if value else None
                if new is not None:
                    updates[column] = new
            if updates:
                sets = ", ".join(f"{qn(c)} = %s" for c in updates)
                cursor.execute(f"UPDATE {table} SET {sets} WHERE {pk} = %s", [*updates.values(), row_pk])


def encrypt_existing(app_label, model_name, field_names):
    """Opération RunPython : chiffre les valeurs encore en clair (réversible avec decrypt_existing)."""
    def run(apps, schema_editor):
        model = apps.get_model(app_label, model_name)
        _convert_column(model, field_names, schema_editor,
                        lambda v: None if is_encrypted(v) else encrypt_str(v))
    return run


def decrypt_existing(app_label, model_name, field_names):
    def run(apps, schema_editor):
        model = apps.get_model(app_label, model_name)
        _convert_column(model, field_names, schema_editor,
                        lambda v: decrypt_str(v) if is_encrypted(v) else None)
    return run
