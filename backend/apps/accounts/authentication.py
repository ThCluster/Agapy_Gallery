from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class AgapyJWTAuthentication(JWTAuthentication):
    """Refuse les jetons émis avant le dernier changement de mot de passe."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)  # vérifie aussi que le compte est actif
        if validated_token.get("ver") != user.auth_version:
            raise AuthenticationFailed("Session expirée, reconnectez-vous.", code="token_revoked")
        return user
