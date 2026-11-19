from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "apps.accounts"
    verbose_name = "Comptes"

    def ready(self):
        from . import schema  # noqa: F401  (enregistre l'extension de documentation)
