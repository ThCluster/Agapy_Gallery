from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    name = "apps.notifications"
    verbose_name = "Notifications"

    def ready(self):
        from . import checks  # noqa: F401  (enregistre les vérifications système)
