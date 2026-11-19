"""
Prestataire simulé : moyen de paiement officiel tant qu'aucun prestataire réel n'est branché.

start() renvoie une page de paiement simulée ; le paiement est confirmé ou refusé en appelant
POST /api/v1/payments/<reference>/simulate/ (disponible seulement si PAYMENT_SIMULATION_ENABLED).
"""
from . import BaseProvider


class FakeProvider(BaseProvider):
    name = "fake"

    def start(self, payment) -> dict:
        return {
            # URL relative : le frontend la résout sur sa propre origine (127.0.0.1, autre port, domaine…)
            "checkout_url": f"/paiement/simulation?ref={payment.reference}",
            "simulate_url": f"/api/v1/payments/{payment.reference}/simulate/",
        }

    def parse_webhook(self, request):
        data = request.data
        return data.get("reference", ""), data.get("status") == "succeeded", data.get("provider_ref", "")
