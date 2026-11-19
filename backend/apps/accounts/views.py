from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError

from apps.core.phone import format_international

from . import services
from .models import User
from .serializers import (
    ForgotRequestSerializer,
    ForgotResetSerializer,
    ForgotVerifySerializer,
    LoginSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    PayoutSerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
    _password,
)
from .tokens import AgapyRefreshToken, clear_refresh_cookie, issue_tokens, set_refresh_cookie

TokenResponse = inline_serializer("TokenResponse", {"access": serializers.CharField(), "user": MeSerializer()})
AccessResponse = inline_serializer("AccessResponse", {"access": serializers.CharField()})
DetailResponse = inline_serializer("DetailResponse", {"detail": serializers.CharField()})


class LoginLocked(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Trop de tentatives. Réessayez dans quelques minutes."
    default_code = "login_locked"


class PublicView(APIView):
    """Vue accessible sans être connecté (le jeton d'accès éventuel est ignoré)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get_authenticate_header(self, request):
        # Sans cela, DRF transforme les erreurs 401 en 403 quand aucune authentification n'est déclarée
        return 'Bearer realm="api"'


def _tokens_response(user, remember: bool, data: dict | None = None, status_code=status.HTTP_200_OK):
    access, refresh = issue_tokens(user, remember=remember)
    response = Response({"access": access, **(data or {})}, status=status_code)
    set_refresh_cookie(response, refresh)
    return response


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------
class LoginView(PublicView):
    """Connexion d'un artiste avec son numéro de téléphone et son mot de passe."""

    throttle_scope = "auth_login"

    @extend_schema(request=LoginSerializer, responses={200: TokenResponse}, tags=["Authentification"])
    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        phone = s.validated_data["phone"]

        if services.is_login_locked(phone):
            raise LoginLocked()
        user = authenticate(request, phone=phone, password=s.validated_data["password"])
        if user is None:
            services.record_login_failure(phone)
            raise AuthenticationFailed("Numéro ou mot de passe incorrect.", code="invalid_credentials")

        services.reset_login_failures(phone)
        update_last_login(None, user)
        return _tokens_response(user, s.validated_data["remember"], {"user": MeSerializer(user, context={"request": request}).data})


class RefreshView(PublicView):
    """
    Nouveau jeton d'accès à partir du cookie de rafraîchissement. Le frontend l'appelle
    au chargement de la page et quand le jeton d'accès expire (réponse 401).
    """

    throttle_scope = "auth_refresh"

    @extend_schema(request=None, responses={200: AccessResponse}, tags=["Authentification"])
    def post(self, request):
        raw = request.COOKIES.get(settings.REFRESH_COOKIE["NAME"])
        failure = AuthenticationFailed("Session expirée, reconnectez-vous.", code="session_expired")
        if not raw:
            raise failure
        try:
            token = AgapyRefreshToken(raw)  # vérifie la signature, l'expiration et la liste noire
        except TokenError:
            raise failure

        user = User.objects.filter(pk=token.get("user_id"), is_active=True).first()
        try:
            token.blacklist()  # usage unique
        except TokenError:
            pass
        if user is None or token.get("ver") != user.auth_version:
            raise failure
        return _tokens_response(user, token.get("rem", True))

    def finalize_response(self, request, response, *args, **kwargs):
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            clear_refresh_cookie(response)
        return super().finalize_response(request, response, *args, **kwargs)


class LogoutView(PublicView):

    @extend_schema(request=None, responses={204: None}, tags=["Authentification"])
    def post(self, request):
        raw = request.COOKIES.get(settings.REFRESH_COOKIE["NAME"])
        if raw:
            try:
                AgapyRefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


# ---------------------------------------------------------------------------
# Mot de passe
# ---------------------------------------------------------------------------
class PasswordChangeView(APIView):
    """Depuis l'espace artiste. Déconnecte les autres appareils, garde la session en cours."""

    @extend_schema(request=PasswordChangeSerializer, responses={200: AccessResponse}, tags=["Mot de passe"])
    def post(self, request):
        s = PasswordChangeSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        services.change_password(request.user, s.validated_data["new_password"])
        return _tokens_response(request.user, request.auth.get("rem", True))


class ForgotRequestView(PublicView):
    """Étape 1 : envoi d'un code à 6 chiffres par SMS. Répond toujours de la même façon."""

    throttle_scope = "password_otp"

    @extend_schema(request=ForgotRequestSerializer, responses={202: DetailResponse}, tags=["Mot de passe"])
    def post(self, request):
        s = ForgotRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.request_reset_code(s.validated_data["phone"])
        minutes = int(settings.PASSWORD_RESET_CODE_LIFETIME.total_seconds() // 60)
        return Response(
            {"detail": "Si ce numéro correspond à un compte, un code vient d'être envoyé par SMS.", "expires_in_minutes": minutes},
            status=status.HTTP_202_ACCEPTED,
        )


class ForgotVerifyView(PublicView):
    """Étape 2 : vérification du code, qui donne un jeton de réinitialisation (15 min)."""

    throttle_scope = "password_verify"

    @extend_schema(
        request=ForgotVerifySerializer,
        responses={200: inline_serializer("ResetTokenResponse", {"reset_token": serializers.CharField()})},
        tags=["Mot de passe"],
    )
    def post(self, request):
        s = ForgotVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            token = services.verify_reset_code(s.validated_data["phone"], s.validated_data["code"])
        except services.ResetError as e:
            raise ValidationError({"code": [serializers.ErrorDetail(e.message, code=e.code)]})
        return Response({"reset_token": token})


class ForgotResetView(PublicView):
    """Étape 3 : enregistrement du nouveau mot de passe. Toutes les sessions sont fermées."""

    throttle_scope = "password_verify"

    @extend_schema(request=ForgotResetSerializer, responses={200: DetailResponse}, tags=["Mot de passe"])
    def post(self, request):
        s = ForgotResetSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            user, entry = services.load_reset_token(s.validated_data["reset_token"])
        except services.ResetError as e:
            raise ValidationError({"reset_token": [serializers.ErrorDetail(e.message, code=e.code)]})
        _password(s.validated_data["password"], user)
        services.reset_password(user, entry, s.validated_data["password"])
        return Response({"detail": "Mot de passe modifié. Vous pouvez vous connecter."})


# ---------------------------------------------------------------------------
# Inscription et compte
# ---------------------------------------------------------------------------
class SignupView(PublicView):
    """
    Inscription d'un artiste ou d'une fondation. Le compte est créé « en attente du paiement » :
    les identifiants sont envoyés par SMS et e-mail une fois les frais d'ouverture payés.
    """

    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "signup"

    @extend_schema(
        request={"multipart/form-data": SignupSerializer},
        responses={201: inline_serializer("SignupResponse", {
            "id": serializers.CharField(), "login": serializers.CharField(),
            "status": serializers.CharField(), "region": serializers.CharField(),
        })},
        tags=["Inscription"],
    )
    def post(self, request):
        s = SignupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        profile = s.save()
        return Response(
            {
                "id": profile.slug,
                "login": format_international(profile.user.phone),
                "status": profile.status,
                "region": profile.region,
            },
            status=status.HTTP_201_CREATED,
        )


def _artist_of(user):
    profile = getattr(user, "artist", None)
    if profile is None:
        raise PermissionDenied("Réservé aux comptes artistes.", code="not_an_artist")
    return profile


class MeView(APIView):
    """Compte connecté : lecture et modification des informations publiques."""

    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(responses={200: MeSerializer}, tags=["Compte"])
    def get(self, request):
        return Response(MeSerializer(request.user, context={"request": request}).data)

    @extend_schema(request=ProfileUpdateSerializer, responses={200: MeSerializer}, tags=["Compte"])
    def patch(self, request):
        s = ProfileUpdateSerializer(_artist_of(request.user), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        request.user.refresh_from_db()
        return Response(MeSerializer(request.user, context={"request": request}).data)


class PayoutView(APIView):
    """Moyens de versement des gains (mobile money et/ou IBAN)."""

    @extend_schema(request=PayoutSerializer, responses={200: MeSerializer}, tags=["Compte"])
    def patch(self, request):
        s = PayoutSerializer(_artist_of(request.user), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        request.user.refresh_from_db()
        return Response(MeSerializer(request.user, context={"request": request}).data)
