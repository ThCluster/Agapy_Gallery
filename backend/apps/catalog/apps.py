from importlib import import_module
from importlib.util import find_spec

from django.apps import AppConfig


class CatalogConfig(AppConfig):
    name = "apps.catalog"
    verbose_name = "Catalogue et modération"

    def ready(self):
        # Actions à exécuter quand un paiement de ce module est confirmé (voir apps.payments.registry)
        if find_spec(f"{self.name}.payment_handlers"):
            import_module(f"{self.name}.payment_handlers")
