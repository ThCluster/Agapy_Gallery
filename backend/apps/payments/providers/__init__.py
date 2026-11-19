"""
Prestataires de paiement, interchangeables comme les backends SMS.

settings.PAYMENT_PROVIDERS associe chaque moyen de paiement (card, momo, wallet) à une classe.
En développement, FakeProvider simule le paiement. Un vrai prestataire (CinetPay, Stripe…)
sera une classe qui hérite de BaseProvider.
"""
from django.conf import settings
from django.utils.module_loading import import_string


class ProviderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class BaseProvider:
    name = "base"

    def start(self, payment) -> dict:
        """
        Lance le paiement. Renvoie ce que le frontend doit faire, par exemple
        {"checkout_url": "..."} pour rediriger, ou {"status": "succeeded"} si le paiement
        est immédiat (Compte d'Avoir). Un paiement immédiat doit appeler services.confirm_payment().
        """
        raise NotImplementedError

    def parse_webhook(self, request) -> tuple[str, bool, str]:
        """Lit la notification du prestataire : (référence AGAPY, payé ?, référence prestataire)."""
        raise NotImplementedError


def get_provider(method: str) -> BaseProvider:
    try:
        path = settings.PAYMENT_PROVIDERS[method]
    except KeyError:
        raise ProviderError("method_unavailable", "Ce moyen de paiement n'est pas disponible.")
    return import_string(path)()
