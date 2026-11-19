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


class BaseSmsBackend:
    def send(self, to: str, message: str) -> None:
        raise NotImplementedError


class ConsoleSmsBackend(BaseSmsBackend):
    """Développement : le SMS est affiché dans la console du serveur."""

    def send(self, to: str, message: str) -> None:
        logger.info("SMS à %s : %s", to, message)
        print(f"\n----- SMS à {to} -----\n{message}\n" + "-" * 30, flush=True)


class LocmemSmsBackend(BaseSmsBackend):
    """Tests : le SMS est gardé dans `outbox`."""

    def send(self, to: str, message: str) -> None:
        outbox.append({"to": to, "message": message})


def get_backend() -> BaseSmsBackend:
    return import_string(settings.SMS_BACKEND)()
