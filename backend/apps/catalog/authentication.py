from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from apps.accounts.authentication import AgapyJWTAuthentication


class OptionalJWTAuthentication(AgapyJWTAuthentication):
    """
    Pour les vues publiques : reconnaît l'artiste ou le staff connecté (accès à ses propres pleines
    résolutions) sans jamais refuser la requête si le jeton est absent, expiré ou invalide.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (AuthenticationFailed, InvalidToken, TokenError):
            return None


class OptionalJWTScheme(SimpleJWTScheme):
    """Documentation (/api/docs/) : même schéma Bearer que le reste de l'API."""

    target_class = "apps.catalog.authentication.OptionalJWTAuthentication"
    name = "jwtAuthOptional"
