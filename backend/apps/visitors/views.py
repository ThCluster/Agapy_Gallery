"""API des visiteurs inscrits : /api/v1/visitors/"""
from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import MeSerializer
from apps.accounts.views import PublicView, _tokens_response
from apps.payments.models import Payment
from apps.payments.serializers import PaymentStatusSerializer
from apps.subscriptions import services as wallets
from apps.subscriptions.views import WalletTopupView, WalletView

from . import services
from .serializers import SignupCodeSerializer, VisitorProfileSerializer, VisitorSignupSerializer, VisitPassSerializer


def _visitor_of(user):
    profile = getattr(user, "visitor", None)
    if profile is None:
        raise PermissionDenied("Réservé aux comptes visiteurs.", code="not_a_visitor")
    return profile


def _field_error(exc: services.VisitorError) -> ValidationError:
    return ValidationError({exc.field: [serializers.ErrorDetail(exc.message, code=exc.code)]})


class SignupCodeView(PublicView):
    """Étape 1 de l'inscription : code à 6 chiffres envoyé par SMS au numéro (preuve de possession)."""

    throttle_scope = "password_otp"

    @extend_schema(request=SignupCodeSerializer, responses={202: inline_serializer("VisitorCodeResponse", {
        "detail": serializers.CharField(), "expires_in_minutes": serializers.IntegerField()})}, tags=["Visiteurs"])
    def post(self, request):
        s = SignupCodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            services.request_signup_code(s.validated_data["phone"])
        except services.VisitorError as e:
            raise _field_error(e)
        minutes = int(settings.PASSWORD_RESET_CODE_LIFETIME.total_seconds() // 60)
        return Response({"detail": "Un code vient d'être envoyé par SMS.", "expires_in_minutes": minutes},
                        status=status.HTTP_202_ACCEPTED)


class SignupView(PublicView):
    """Étape 2 : création du compte visiteur (gratuite). Connecte directement le visiteur (comme /auth/login/)."""

    throttle_scope = "signup"

    @extend_schema(request=VisitorSignupSerializer, responses={201: inline_serializer("VisitorSignupResponse", {
        "access": serializers.CharField(), "user": MeSerializer()})}, tags=["Visiteurs"])
    def post(self, request):
        s = VisitorSignupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        try:
            user = services.create_visitor(phone=d["phone"], code=d["code"], password=d["password"],
                                           display_name=d["display_name"], country=d["country"], email=d["email"])
        except services.VisitorError as e:
            raise _field_error(e)
        user.refresh_from_db()
        return _tokens_response(user, d["remember"], {"user": MeSerializer(user, context={"request": request}).data},
                                status_code=status.HTTP_201_CREATED)


class MeView(APIView):
    """Profil du visiteur connecté (le pays n'est pas modifiable)."""

    @extend_schema(responses={200: VisitorProfileSerializer}, tags=["Visiteurs"])
    def get(self, request):
        return Response(VisitorProfileSerializer(_visitor_of(request.user)).data)

    @extend_schema(request=VisitorProfileSerializer, responses={200: VisitorProfileSerializer}, tags=["Visiteurs"])
    def patch(self, request):
        s = VisitorProfileSerializer(_visitor_of(request.user), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class VisitorWalletView(WalletView):
    """Compte d'Avoir du visiteur : solde, état (activer / désactiver) et historique paginé (?page=)."""

    def get_wallet(self, request):
        _visitor_of(request.user)
        return wallets.ensure_visitor_wallet(request.user)


class VisitorWalletTopupView(WalletTopupView):
    """Recharge du Compte d'Avoir du visiteur par carte ou mobile money."""

    def get_wallet(self, request):
        _visitor_of(request.user)
        return wallets.ensure_visitor_wallet(request.user)


class MyVisitsView(APIView):
    """Droits de visite encore valables du compte connecté (visiteur ou artiste), un par artiste."""

    @extend_schema(responses={200: VisitPassSerializer(many=True)}, tags=["Visiteurs"])
    def get(self, request):
        return Response(VisitPassSerializer(services.valid_visit_passes(request.user), many=True).data)


class Pagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class MyPaymentsView(ListAPIView):
    """Paiements effectués par le compte connecté (visites, dons, recharges…), du plus récent au plus ancien."""

    serializer_class = PaymentStatusSerializer
    pagination_class = Pagination

    def get_queryset(self):
        return (Payment.objects.filter(payer_user=self.request.user)
                .select_related("artist", "visit_pass").order_by("-created_at", "-pk"))

    @extend_schema(tags=["Visiteurs"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
