"""Actions déclenchées par la confirmation des paiements de ce module (voir apps.payments.registry)."""
from apps.payments.registry import on_paid

from . import services


@on_paid("signup")
def signup_paid(payment):
    # Le statut du compte (activation) est géré par le module accounts sur ce même paiement
    if payment.artist_id:
        services.start_subscription(payment.artist, payment)


@on_paid("renewal")
def renewal_paid(payment):
    if payment.artist_id:
        services.renew(payment.artist, payment)


@on_paid("wallet_topup")
def wallet_topup_paid(payment):
    if payment.artist_id:
        services.credit_topup(payment)
