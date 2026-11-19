"""
Jetons de session.

- Jeton d'accès (15 min) : renvoyé dans la réponse JSON, gardé EN MÉMOIRE par le frontend
  et envoyé dans l'en-tête « Authorization: Bearer … ».
- Jeton de rafraîchissement (30 jours, ou 12 h sans « Se souvenir de moi ») : dans un cookie
  HttpOnly, illisible par JavaScript, limité aux adresses /api/v1/auth/. Il est remplacé à
  chaque usage et l'ancien est révoqué (liste noire).
- Les deux portent « ver » = User.auth_version : changer le mot de passe invalide tout.
"""
from django.conf import settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken


class AgapyRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user, remember: bool = True):
        token = super().for_user(user)
        token["ver"] = user.auth_version
        token["rem"] = bool(remember)
        if not remember:
            token.set_exp(lifetime=settings.REFRESH_TOKEN_SHORT_LIFETIME)
            OutstandingToken.objects.filter(jti=token["jti"]).update(expires_at=token.current_time + settings.REFRESH_TOKEN_SHORT_LIFETIME)
        return token


def issue_tokens(user, remember: bool = True) -> tuple[str, AgapyRefreshToken]:
    refresh = AgapyRefreshToken.for_user(user, remember=remember)
    return str(refresh.access_token), refresh


def revoke_all_tokens(user) -> None:
    """Déconnecte l'utilisateur partout (changement ou réinitialisation du mot de passe)."""
    user.auth_version += 1
    user.save(update_fields=["auth_version"])
    pending = OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True)
    BlacklistedToken.objects.bulk_create([BlacklistedToken(token=t) for t in pending], ignore_conflicts=True)


def set_refresh_cookie(response, refresh: AgapyRefreshToken) -> None:
    cfg = settings.REFRESH_COOKIE
    max_age = None
    if refresh.get("rem", True):
        max_age = max(0, int(refresh["exp"] - refresh.current_time.timestamp()))
    response.set_cookie(
        cfg["NAME"], str(refresh),
        max_age=max_age,  # None = cookie de session, effacé à la fermeture du navigateur
        path=cfg["PATH"], domain=cfg["DOMAIN"],
        secure=cfg["SECURE"], httponly=True, samesite=cfg["SAMESITE"],
    )


def clear_refresh_cookie(response) -> None:
    cfg = settings.REFRESH_COOKIE
    response.delete_cookie(cfg["NAME"], path=cfg["PATH"], domain=cfg["DOMAIN"], samesite=cfg["SAMESITE"])
