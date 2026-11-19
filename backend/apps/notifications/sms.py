"""
Envoi des SMS, sur le modèle des backends d'e-mail de Django.

Le fournisseur réel (Orange SMS API, Twilio, etc.) n'est pas encore choisi : il suffira
d'écrire une classe qui hérite de BaseSmsBackend et de la déclarer dans SMS_BACKEND.
"""
import logging

from django.conf import settings
from django.utils.module_loading import import_string

logger = logging.getLogger("agapy.sms")

# Messages envoyés pendant les tests (LocmemSmsBackend)
outbox: list[dict] = []


def mask_phone(phone: str) -> str:
    """« +2250501020304 » → « +225…04 » : pour les journaux et les messages, sans le numéro complet."""
    phone = phone or ""
    if len(phone) <= 6:
        return "…" + phone[-2:]
    return f"{phone[:4]}…{phone[-2:]}"


class BaseSmsBackend:
    def send(self, to: str, message: str) -> None:
        raise NotImplementedError


class ConsoleSmsBackend(BaseSmsBackend):
    """
    Développement : le SMS est affiché dans la console du serveur.

    Les SMS contiennent des secrets (mot de passe à l'activation, code de réinitialisation) :
    hors DEBUG, seuls le destinataire masqué et la longueur sont journalisés.
    """

    def send(self, to: str, message: str) -> None:
        if settings.DEBUG:
            logger.info("SMS à %s : %s", to, message)
            print(f"\n----- SMS à {to} -----\n{message}\n" + "-" * 30, flush=True)
        else:
            logger.info("SMS à %s (%d caractères, contenu non journalisé)", mask_phone(to), len(message))


class LocmemSmsBackend(BaseSmsBackend):
    """Tests : le SMS est gardé dans `outbox`."""

    def send(self, to: str, message: str) -> None:
        outbox.append({"to": to, "message": message})


def get_backend() -> BaseSmsBackend:
    return import_string(settings.SMS_BACKEND)()
