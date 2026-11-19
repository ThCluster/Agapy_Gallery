from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from apps.accounts.views import PublicView
from apps.payments.providers import ProviderError
from apps.payments.serializers import PaymentSummarySerializer

from . import services
from .models import AdFormat
from .serializers import (
    AdCampaignSerializer,
    ClipCreateSerializer,
    ClipSerializer,
    LiveClipSerializer,
    LiveStreamSerializer,
)

ClipOrderResponse = inline_serializer("ClipOrderResponse", {
    "clip": ClipSerializer(), "payment": PaymentSummarySerializer(), "action": serializers.DictField(),
})
LiveTvResponse = inline_serializer("LiveTvResponse", {
    "live": LiveStreamSerializer(allow_null=True), "upcoming": LiveStreamSerializer(many=True),
})


class ClipCreateView(APIView):
    """
    Commande d'un clip de 30 s sur l'accueil pendant 24 h (3 300 F TTC), sans compte.
    Un artiste connecté peut aussi commander : le clip et le paiement lui sont alors rattachés.
    """

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(request=ClipCreateSerializer, responses={201: ClipOrderResponse}, tags=["Publicité"])
    def post(self, request):
        s = ClipCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        method = data.pop("method")
        try:
            clip, payment, action = services.order_clip(data=data, method=method, user=request.user)
        except ProviderError as e:
            raise ValidationError({"method": [e.message]}, code=e.code)
        return Response({
            "clip": ClipSerializer(clip, context={"request": request}).data,
            "payment": PaymentSummarySerializer(payment).data,
            "action": action,
        }, status=status.HTTP_201_CREATED)


class LiveClipsView(PublicView):
    """Clips en diffusion (50 au plus), à enchaîner en boucle sur l'accueil."""

    @extend_schema(responses={200: LiveClipSerializer(many=True)}, tags=["Publicité"])
    def get(self, request):
        return Response(LiveClipSerializer(services.live_clips(), many=True, context={"request": request}).data)


class _SettingsWithoutFormatOverride:
    URL_FORMAT_OVERRIDE = None

    def __getattr__(self, name):
        return getattr(api_settings, name)


class FormatParamNegotiation(DefaultContentNegotiation):
    """Ici ?format= désigne le format publicitaire, pas le format de réponse de DRF (toujours JSON)."""

    settings = _SettingsWithoutFormatOverride()


class AdsView(PublicView):
    """Campagnes à afficher dans un espace publicitaire (3 pour les boutons 88 × 31, 1 sinon)."""

    content_negotiation_class = FormatParamNegotiation

    @extend_schema(parameters=[OpenApiParameter("format", enum=AdFormat.values, required=True)],
                   responses={200: AdCampaignSerializer(many=True)}, tags=["Publicité"])
    def get(self, request):
        fmt = request.query_params.get("format", "")
        if fmt not in AdFormat.values:
            raise ValidationError({"format": ["Format d'espace publicitaire inconnu."]}, code="invalid_format")
        return Response(AdCampaignSerializer(services.pick_ads(fmt), many=True, context={"request": request}).data)


class LiveTvView(PublicView):
    """TV en ligne : direct en cours et prochaines émissions."""

    @extend_schema(responses={200: LiveTvResponse}, tags=["Publicité"])
    def get(self, request):
        tv = services.live_tv()
        return Response({
            "live": LiveStreamSerializer(tv["live"]).data if tv["live"] else None,
            "upcoming": LiveStreamSerializer(tv["upcoming"], many=True).data,
        })
