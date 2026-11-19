"""API des paiements : tarifs, ouverture de compte, visites, dons, espace artiste."""
from django.conf import settings
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import ArtistProfile, ArtistStatus
from apps.core.pricing import clip_quote, quote

from . import services
from .models import Payment
from .providers import ProviderError
from .serializers import (
    BalanceSerializer, DonationSerializer, PaymentStatusSerializer, PayoutCreateSerializer, PayoutSerializer,
    QuoteQuerySerializer, SignupPaymentSerializer, SimulateSerializer, TransactionSerializer, VisitPaymentSerializer,
)

ERROR_STATUS = {
    "artist_not_found": status.HTTP_404_NOT_FOUND,
    "not_pending_payment": status.HTTP_409_CONFLICT,
    "visit_token_invalid": status.HTTP_403_FORBIDDEN,
    "not_artist": status.HTTP_403_FORBIDDEN,
}

StartResponse = inline_serializer("PaymentStartResponse", {
    "payment": PaymentStatusSerializer(), "action": serializers.DictField(),
})
AccessResponse = inline_serializer("VisitAccessResponse", {
    "access": serializers.BooleanField(), "free": serializers.BooleanField(),
    "expires_at": serializers.DateTimeField(allow_null=True),
})


class PaymentAPIError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, code: str, message: str):
        self.status_code = ERROR_STATUS.get(code, status.HTTP_400_BAD_REQUEST)
        super().__init__(detail=message, code=code)


def api_error(exc) -> PaymentAPIError:
    return PaymentAPIError(exc.code, exc.message)


# ---------------------------------------------------------------------------
# Limites de débit (par adresse IP)
# ---------------------------------------------------------------------------
class PaymentCreateThrottle(AnonRateThrottle):
    scope = "payments_create"
    rate = "30/hour"


class PaymentReadThrottle(AnonRateThrottle):
    scope = "payments_read"
    rate = "120/min"


class PayoutThrottle(AnonRateThrottle):
    scope = "payments_payout"
    rate = "10/hour"

    def get_cache_key(self, request, view):  # par artiste connecté
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class PublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'


def _active_artist(slug: str) -> ArtistProfile:
    artist = ArtistProfile.objects.filter(slug=slug, status=ArtistStatus.ACTIVE).first()
    if artist is None:
        raise PaymentAPIError("artist_not_found", "Cet artiste ne figure pas sur AGAPY-GALLERY.")
    return artist


def _start_response(payment: Payment) -> Response:
    try:
        action = services.start_payment(payment)
    except ProviderError as exc:
        raise api_error(exc)
    payment.refresh_from_db()
    return Response({"payment": PaymentStatusSerializer(payment).data, "action": action},
                    status=status.HTTP_201_CREATED)


def _payer(data: dict) -> dict:
    return {k: data.get(k, "") for k in ("payer_name", "payer_email", "payer_phone")}


def _visitor_key(request) -> str:
    return request.META.get("REMOTE_ADDR", "")


# ---------------------------------------------------------------------------
# Génériques
# ---------------------------------------------------------------------------
class QuoteView(PublicView):
    """Montant à payer (HT, TVA, TTC) pour un tarif du cahier des charges et une zone."""

    throttle_classes = [PaymentReadThrottle]

    @extend_schema(parameters=[QuoteQuerySerializer], responses={200: inline_serializer("TariffQuote", {
        "kind": serializers.CharField(), "region": serializers.CharField(), "amount_ht": serializers.CharField(),
        "vat": serializers.CharField(), "amount_ttc": serializers.CharField(), "currency": serializers.CharField(),
    })}, tags=["Paiements"])
    def get(self, request):
        s = QuoteQuerySerializer(data=request.query_params)
        s.is_valid(raise_exception=True)
        kind, region = s.validated_data["kind"], s.validated_data["region"]
        q = clip_quote() if kind == "clip" else quote(kind, region)
        return Response({"kind": kind, "region": region, **q.as_dict()})


class PaymentStatusView(PublicView):
    """Statut d'un paiement (la référence n'est pas devinable). Pour une visite payée, renvoie le jeton."""

    throttle_classes = [PaymentReadThrottle]

    @extend_schema(responses={200: PaymentStatusSerializer}, tags=["Paiements"])
    def get(self, request, reference):
        payment = Payment.objects.select_related("artist").filter(reference=reference).first()
        if payment is None:
            raise Http404
        return Response(PaymentStatusSerializer(payment).data)


class SimulateView(PublicView):
    """Développement uniquement : confirme ou refuse un paiement du prestataire simulé."""

    @extend_schema(request=SimulateSerializer, responses={200: PaymentStatusSerializer}, tags=["Paiements"])
    def post(self, request, reference):
        if not settings.PAYMENT_SIMULATION_ENABLED:
            raise Http404
        payment = Payment.objects.filter(reference=reference).first()
        if payment is None:
            raise Http404
        s = SimulateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if s.validated_data["status"] == "succeeded":
            payment = services.confirm_payment(payment, provider_ref=f"sim-{payment.reference[:8]}")
        else:
            payment = services.fail_payment(payment, "Paiement simulé refusé")
        return Response(PaymentStatusSerializer(payment).data)


class WebhookView(PublicView):
    """Notification d'un prestataire de paiement. Idempotente."""

    @extend_schema(request=None, responses={200: None}, tags=["Paiements"])
    def post(self, request, provider):
        prov = services.provider_by_name(provider)
        if prov is None or (prov.name == "fake" and not settings.PAYMENT_SIMULATION_ENABLED):
            raise Http404
        try:
            payment = services.handle_webhook(prov, request)
        except ProviderError as exc:
            raise api_error(exc)
        if payment is None:
            raise Http404
        return Response({"received": True, "status": payment.status})


# ---------------------------------------------------------------------------
# Ouverture de compte
# ---------------------------------------------------------------------------
class SignupPaymentView(PublicView):
    """Paiement des frais d'ouverture d'un compte en attente. Le compte est activé à la confirmation."""

    throttle_classes = [PaymentCreateThrottle]

    @extend_schema(request=SignupPaymentSerializer, responses={201: StartResponse}, tags=["Paiements"])
    def post(self, request):
        s = SignupPaymentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        artist = ArtistProfile.objects.select_related("user").filter(slug=s.validated_data["artist"]).first()
        if artist is None:
            raise PaymentAPIError("artist_not_found", "Compte introuvable.")
        try:
            payment = services.create_signup_payment(artist, s.validated_data["method"])
        except (services.PaymentError, ProviderError) as exc:
            raise api_error(exc)
        return _start_response(payment)


# ---------------------------------------------------------------------------
# Visites
# ---------------------------------------------------------------------------
class VisitPaymentView(PublicView):
    """
    Droit de visite d'une galerie. Galerie gratuite : accès direct, sans paiement (200).
    Sinon un paiement est créé (201) ; une fois payé, GET /payments/<ref>/ renvoie le jeton de visite.
    """

    throttle_classes = [PaymentCreateThrottle]

    @extend_schema(request=VisitPaymentSerializer, responses={201: StartResponse, 200: AccessResponse},
                   tags=["Visites et dons"])
    def post(self, request):
        s = VisitPaymentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        artist = _active_artist(s.validated_data["artist"])
        if services.gallery_is_free(artist):
            services.log_free_visit(artist, _visitor_key(request))
            return Response({"access": True, "free": True, "expires_at": None})
        try:
            payment = services.create_visit_payment(artist, s.validated_data["method"], s.validated_data["region"],
                                                    _payer(s.validated_data))
        except (services.PaymentError, ProviderError) as exc:
            raise api_error(exc)
        return _start_response(payment)


class VisitAccessView(PublicView):
    """Le visiteur peut-il voir la galerie ? Jeton de visite dans l'en-tête X-Visit-Token."""

    throttle_classes = [PaymentReadThrottle]

    @extend_schema(parameters=[
        OpenApiParameter("artist", str, required=True, description="Identifiant public de l'artiste"),
        OpenApiParameter("X-Visit-Token", str, OpenApiParameter.HEADER, required=False),
    ], responses={200: AccessResponse}, tags=["Visites et dons"])
    def get(self, request):
        artist = _active_artist(request.query_params.get("artist", ""))
        try:
            result = services.check_visit_access(artist, request.headers.get("X-Visit-Token"))
        except services.PaymentError as exc:
            raise api_error(exc)
        if result["free"]:
            services.log_free_visit(artist, _visitor_key(request))
        return Response(result)


# ---------------------------------------------------------------------------
# Dons
# ---------------------------------------------------------------------------
class DonationView(PublicView):
    """Don à un artiste (85 % à l'artiste, 15 % à AGAPY, sans TVA). Indépendant du droit de visite."""

    throttle_classes = [PaymentCreateThrottle]

    @extend_schema(request=DonationSerializer, responses={201: StartResponse}, tags=["Visites et dons"])
    def post(self, request):
        s = DonationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        artist = _active_artist(d["artist"])
        try:
            payment = services.create_donation_payment(artist, d["amount"], d["currency"], d["region"], d["method"],
                                                       _payer(d), message=d["message"])
        except (services.PaymentError, ProviderError) as exc:
            raise api_error(exc)
        return _start_response(payment)


# ---------------------------------------------------------------------------
# Espace artiste
# ---------------------------------------------------------------------------
class ArtistMixin:
    def get_artist(self) -> ArtistProfile:
        artist = getattr(self.request.user, "artist", None)
        if artist is None:
            raise PermissionDenied("Réservé aux artistes.", code="not_artist")
        return artist


class Pagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class BalanceView(ArtistMixin, APIView):
    """Solde par devise : disponible, versé, en cours de versement, total gagné, provision retenue."""

    @extend_schema(responses={200: BalanceSerializer(many=True)}, tags=["Espace artiste — revenus"])
    def get(self, request):
        return Response(BalanceSerializer(services.balances(self.get_artist()), many=True).data)


class TransactionListView(ArtistMixin, ListAPIView):
    """Paiements reçus (visites, dons) et payés (ouverture, publication, renouvellement…)."""

    serializer_class = TransactionSerializer
    pagination_class = Pagination

    def get_queryset(self):
        return services.artist_transactions(self.get_artist())

    @extend_schema(tags=["Espace artiste — revenus"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PayoutView(ArtistMixin, ListAPIView):
    """Demandes de versement : liste et nouvelle demande (traitée par l'équipe AGAPY)."""

    serializer_class = PayoutSerializer
    pagination_class = Pagination

    def get_throttles(self):
        return [PayoutThrottle()] if self.request.method == "POST" else []

    def get_queryset(self):
        return self.get_artist().payout_requests.all()

    @extend_schema(tags=["Espace artiste — revenus"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(request=PayoutCreateSerializer, responses={201: PayoutSerializer}, tags=["Espace artiste — revenus"])
    def post(self, request):
        s = PayoutCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            payout = services.request_payout(self.get_artist(), **s.validated_data)
        except services.PaymentError as exc:
            raise api_error(exc)
        return Response(PayoutSerializer(payout).data, status=status.HTTP_201_CREATED)
