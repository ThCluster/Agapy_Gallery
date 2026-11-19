"""
Chiffrement du contenu des notifications en attente d'envoi.

Réutilise le chiffrement commun (apps.core.fields : Fernet, clé FIELD_ENCRYPTION_KEY, rotation
possible). Sans clé hors DEBUG, le chiffrement lève ImproperlyConfigured : le message est alors
envoyé immédiatement (voir services._enqueue).
"""
import json

from django.core.exceptions import ImproperlyConfigured

from apps.core.fields import decrypt_str, encrypt_str


def encrypt_json(data: dict) -> str:
    return encrypt_str(json.dumps(data))


def decrypt_json(token: str) -> dict:
    """Lève ValueError si le contenu est illisible (clé changée, données altérées)."""
    try:
        return json.loads(decrypt_str(token))
    except (ImproperlyConfigured, ValueError, UnicodeError) as exc:
        raise ValueError("Contenu chiffré illisible.") from exc
