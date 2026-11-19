from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

admin.site.site_header = "Administration AGAPY-GALLERY"
admin.site.site_title = "AGAPY-GALLERY"
admin.site.index_title = "Tableau de bord"

urlpatterns = [
    # Le backend ne sert que l'API et l'administration : la racine renvoie vers le site
    path("", RedirectView.as_view(url=settings.FRONTEND_URL, permanent=False)),
    path(settings.ADMIN_URL, admin.site.urls),  # chemin configurable (ADMIN_URL dans .env)
    path("api/v1/auth/", include("apps.accounts.urls.auth")),
    path("api/v1/accounts/", include("apps.accounts.urls.accounts")),
    path("api/v1/catalog/", include("apps.catalog.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/subscriptions/", include("apps.subscriptions.urls")),
    path("api/v1/promotions/", include("apps.promotions.urls")),
    path("api/v1/site/", include("apps.site_content.urls")),
    path("api/v1/dashboards/", include("apps.dashboards.urls")),
    path("api/v1/forum/", include("apps.forum.urls")),
    # Documentation de l'API (réservée au staff hors DEBUG : SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"])
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
