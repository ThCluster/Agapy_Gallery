"""
Limite les tentatives sur la page de connexion de l'administration Django.

Après ADMIN_LOGIN_MAX_FAILURES échecs depuis une même adresse IP, ou sur un même identifiant,
la connexion est refusée (429) pendant ADMIN_LOGIN_LOCKOUT. Un échec se reconnaît à la page
de connexion réaffichée (200) ; une connexion réussie redirige (302) et remet l'IP à zéro.
"""
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.urls import NoReverseMatch, reverse

from apps.core.net import client_ip

from .services import incr_counter


class AdminLoginThrottleMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _login_path():
        try:
            return reverse("admin:login")
        except NoReverseMatch:
            return None

    def __call__(self, request):
        if request.method != "POST" or request.path != self._login_path():
            return self.get_response(request)

        username = (request.POST.get("username") or "").strip().lower()
        keys = [f"admin-login-ip:{client_ip(request)}"]
        if username:
            keys.append(f"admin-login-user:{username}")
        if any(cache.get(k, 0) >= settings.ADMIN_LOGIN_MAX_FAILURES for k in keys):
            return HttpResponse(
                "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
                status=429, content_type="text/plain; charset=utf-8",
            )

        response = self.get_response(request)
        if response.status_code == 200:  # formulaire réaffiché : identifiants refusés
            timeout = int(settings.ADMIN_LOGIN_LOCKOUT.total_seconds())
            for k in keys:
                incr_counter(k, timeout)
        elif response.status_code in (301, 302, 303):
            cache.delete_many(keys)
        return response
