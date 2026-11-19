"""
Compte d'Avoir utilisé comme moyen de paiement (settings.PAYMENT_PROVIDERS["wallet"]).

Le paiement est immédiat : start() débite le compte et confirme le paiement.
"""
from apps.payments.providers import BaseProvider, ProviderError


class WalletProvider(BaseProvider):
    name = "wallet"

    def start(self, payment) -> dict:
        from . import services

        return services.pay_with_wallet(payment)

    def parse_webhook(self, request):
        raise ProviderError("no_webhook", "Le Compte d'Avoir n'envoie pas de notification.")
