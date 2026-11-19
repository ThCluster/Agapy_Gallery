"""Actions du module paiements à la confirmation d'un paiement (voir registry.on_paid)."""
from .models import Purpose
from .registry import on_paid
from . import services


@on_paid(Purpose.SIGNUP)
def activate_after_signup(payment):
    from apps.accounts.services import activate_account

    if payment.artist_id:
        activate_account(payment.artist)


@on_paid(Purpose.VISIT)
def issue_visit_pass(payment):
    if payment.artist_id:
        services.issue_visit_pass(payment)


# Répartition des revenus au grand livre (la recharge du Compte d'Avoir n'est pas un revenu)
for _purpose in (Purpose.SIGNUP, Purpose.RENEWAL, Purpose.PUBLICATION, Purpose.CLIP, Purpose.VISIT, Purpose.DONATION):
    on_paid(_purpose)(services.record_revenue)
