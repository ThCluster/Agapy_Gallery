"""Déclare l'authentification JWT d'AGAPY dans la documentation de l'API (/api/docs/)."""
from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme


class AgapyJWTScheme(SimpleJWTScheme):
    target_class = "apps.accounts.authentication.AgapyJWTAuthentication"
    name = "jwtAuth"
