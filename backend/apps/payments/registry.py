"""
Ce qu'il faut faire quand un paiement est confirmé, déclaré par chaque module.

    from apps.payments.registry import on_paid

    @on_paid("publication")
    def publication_paid(payment):
        ...  # passer l'œuvre en attente de modération

Les fonctions sont appelées dans la transaction qui confirme le paiement : si l'une échoue,
la confirmation est annulée. Les modules déclarent leurs fonctions dans un fichier
`payment_handlers.py`, importé par leur AppConfig.ready().
"""
from collections import defaultdict
from typing import Callable

_handlers: dict[str, list[Callable]] = defaultdict(list)


def on_paid(purpose: str):
    def decorator(func):
        if func not in _handlers[purpose]:
            _handlers[purpose].append(func)
        return func
    return decorator


def run_handlers(payment) -> None:
    for func in _handlers.get(payment.purpose, []):
        func(payment)
