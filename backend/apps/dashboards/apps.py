from django.apps import AppConfig


class DashboardsConfig(AppConfig):
    name = "apps.dashboards"
    verbose_name = "Tableaux de bord"

    def ready(self):
        from .admin_site import install
        install()
