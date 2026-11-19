"""
Tableau de bord de l'équipe AGAPY dans l'administration Django : /admin/tableau-de-bord/.

Ajouté au site d'administration existant sans toucher à config/ : l'URL est insérée dans
admin.site.get_urls() et l'index de l'admin reçoit un lien (template qui étend admin/index.html).
"""
from django.contrib import admin
from django.template.response import TemplateResponse
from django.urls import path

from . import services


def staff_dashboard_view(request):
    period = request.GET.get("period") or "month"
    if period not in services.RANKING_PERIODS:
        period = "month"
    currency = request.GET.get("currency") or "XOF"
    if currency not in services.CURRENCIES:
        currency = "XOF"
    data = services.staff_overview(period=period, currency=currency)
    windows = [("Aujourd'hui", data["figures"]["day"]), ("Cette semaine", data["figures"]["week"]),
               ("Ce mois-ci", data["figures"]["month"])]
    context = {
        **admin.site.each_context(request),
        "title": "Tableau de bord AGAPY-GALLERY",
        "data": data,
        "windows": windows,
        "periods": services.RANKING_PERIOD_LABELS.items(),
        "currencies": services.CURRENCIES,
    }
    return TemplateResponse(request, "dashboards/staff_dashboard.html", context)


def install(site=admin.site):
    if getattr(site, "_agapy_dashboard_installed", False):
        return
    original = site.get_urls

    def get_urls():
        return [path("tableau-de-bord/", site.admin_view(staff_dashboard_view), name="agapy_dashboard")] + original()

    site.get_urls = get_urls
    if site.index_template is None:
        site.index_template = "dashboards/admin_index.html"
    site._agapy_dashboard_installed = True
