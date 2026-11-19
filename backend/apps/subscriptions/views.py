from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.providers import ProviderError

from . import services
from .serializers import (
    PaymentStartSerializer,
    PaymentSummarySerializer,
    RenewSerializer,
    SubscriptionSerializer,
    TopupSerializer,
    WalletEntrySerializer,
    WalletSerializer,
    WalletUpdateSerializer,
)

WalletPage = inline_serializer("WalletPage", {
    "is_active": serializers.BooleanField(), "balance": serializers.CharField(), "currency": serializers.CharField(),
    "history": inline_serializer("WalletHistory", {
        "count": serializers.IntegerField(), "next": serializers.CharField(allow_null=True),
        "previous": serializers.CharField(allow_null=True), "results": WalletEntrySerializer(many=True)}),
})


def _artist_of(user):
    profile = getattr(user, "artist", None)
    if profile is None:
        raise PermissionDenied("Réservé aux comptes artistes.", code="not_an_artist")
    return profile


def _payment_response(payment, action):
    return Response({"payment": PaymentSummarySerializer(payment).data, "action": action},
                    status=status.HTTP_201_CREATED)


def _run(func, *args):
    """Traduit les erreurs métier et de paiement en 400 avec leur code stable."""
    try:
        return func(*args)
    except (ProviderError, services.SubscriptionError) as e:
        raise ValidationError({"detail": e.message}, code=e.code) from e


class HistoryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class SubscriptionMeView(APIView):
    """Abonnement annuel de l'artiste connecté."""

    @extend_schema(responses={200: SubscriptionSerializer}, tags=["Abonnement"])
    def get(self, request):
        summary = services.subscription_summary(_artist_of(request.user))
        if summary is None:
            raise NotFound("Aucun abonnement : le compte n'est pas encore activé.", code="no_subscription")
        return Response(SubscriptionSerializer(summary).data)


class RenewView(APIView):
    """Lance le paiement du renouvellement annuel (carte, mobile money ou Compte d'Avoir)."""

    @extend_schema(request=RenewSerializer, responses={201: PaymentStartSerializer}, tags=["Abonnement"])
    def post(self, request):
        artist = _artist_of(request.user)
        s = RenewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        payment, action = _run(services.request_renewal, artist, request.user, s.validated_data["method"])
        payment.refresh_from_db()
        return _payment_response(payment, action)


class WalletView(APIView):
    """Compte d'Avoir : solde, état et historique paginé (?page=)."""

    def get_wallet(self, request):
        """Compte d'Avoir du compte connecté (redéfini par l'espace visiteur)."""
        return services.ensure_wallet(_artist_of(request.user))

    def _render(self, request, wallet):
        paginator = HistoryPagination()
        page = paginator.paginate_queryset(wallet.entries.select_related("payment"), request, view=self)
        data = WalletSerializer(wallet).data
        data["history"] = {
            "count": paginator.page.paginator.count,
            "next": paginator.get_next_link(),
            "previous": paginator.get_previous_link(),
            "results": WalletEntrySerializer(page, many=True).data,
        }
        return Response(data)

    @extend_schema(responses={200: WalletPage}, tags=["Compte d'Avoir"])
    def get(self, request):
        return self._render(request, self.get_wallet(request))

    @extend_schema(request=WalletUpdateSerializer, responses={200: WalletPage}, tags=["Compte d'Avoir"])
    def patch(self, request):
        wallet = self.get_wallet(request)
        s = WalletUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return self._render(request, services.set_active(wallet, s.validated_data["is_active"]))


class WalletTopupView(APIView):
    """Recharge du Compte d'Avoir par carte ou mobile money (montant libre, sans TVA)."""

    def get_wallet(self, request):
        """Compte d'Avoir du compte connecté (redéfini par l'espace visiteur)."""
        return services.ensure_wallet(_artist_of(request.user))

    @extend_schema(request=TopupSerializer, responses={201: PaymentStartSerializer}, tags=["Compte d'Avoir"])
    def post(self, request):
        wallet = self.get_wallet(request)
        s = TopupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        payment, action = _run(services.request_wallet_topup, wallet, request.user,
                               s.validated_data["amount"], s.validated_data["method"])
        return _payment_response(payment, action)
