"""Actions du catalogue quand un paiement est confirmé (voir apps.payments.registry)."""
from apps.payments.registry import on_paid

from . import services


@on_paid("publication")
def publication_paid(payment):
    """Droit de publication payé : l'œuvre passe en attente de validation par l'équipe."""
    services.publication_paid(payment)
