from datetime import date

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services

TAGS = ["Tableaux de bord"]


def _artist_of(user):
    profile = getattr(user, "artist", None)
    if profile is None:
        raise PermissionDenied("Réservé aux comptes artistes.", code="not_an_artist")
    return profile


def _date_param(request, name):
    value = request.query_params.get(name)
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({name: ["Date invalide (AAAA-MM-JJ)."]}, code="invalid_date")


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except services.DashboardError as e:
        raise ValidationError({"detail": e.message}, code=e.code)


Money = serializers.CharField
SummaryResponse = inline_serializer("DashboardSummary", {
    "currency": serializers.CharField(),
    "available_balance": Money(), "total_earned": Money(), "provision_held": Money(),
    "visits": inline_serializer("DashboardVisits", {
        "total": serializers.IntegerField(), "paid": serializers.IntegerField(),
        "free": serializers.IntegerField(), "last_30_days": serializers.IntegerField()}),
    "donations": inline_serializer("DashboardDonations", {"count": serializers.IntegerField(), "total": Money()}),
    "artworks": inline_serializer("DashboardArtworks", {
        "published": serializers.IntegerField(), "pending_review": serializers.IntegerField(),
        "rejected": serializers.IntegerField(), "draft": serializers.IntegerField(),
        "total_views": serializers.IntegerField()}),
    "top_artworks": inline_serializer("DashboardTopArtwork", {
        "id": serializers.CharField(), "title": serializers.CharField(), "view_count": serializers.IntegerField()},
        many=True),
})
_point = {"visits": Money(), "donations": Money(), "total": Money(), "visit_count": serializers.IntegerField()}
RevenueResponse = inline_serializer("DashboardRevenue", {
    "currency": serializers.CharField(), "currencies": serializers.ListField(child=serializers.CharField()),
    "period": serializers.CharField(), "from": serializers.DateField(), "to": serializers.DateField(),
    "series": inline_serializer("DashboardRevenuePoint", {"start": serializers.DateField(), **_point}, many=True),
    "totals": inline_serializer("DashboardRevenueTotals", _point),
})


class MySummaryView(APIView):
    """Chiffres clés de l'artiste connecté (solde, visites, dons, œuvres)."""

    @extend_schema(responses={200: SummaryResponse}, tags=TAGS)
    def get(self, request):
        return Response(services.artist_summary(_artist_of(request.user)))


class MyRevenueView(APIView):
    """Évolution des revenus de l'artiste (part artiste des visites et des dons) par période."""

    @extend_schema(
        parameters=[
            OpenApiParameter("period", OpenApiTypes.STR, enum=list(services.PERIODS)),
            OpenApiParameter("from", OpenApiTypes.DATE), OpenApiParameter("to", OpenApiTypes.DATE),
            OpenApiParameter("currency", OpenApiTypes.STR, enum=list(services.CURRENCIES)),
        ],
        responses={200: RevenueResponse}, tags=TAGS,
    )
    def get(self, request):
        artist = _artist_of(request.user)
        q = request.query_params
        return Response(_run(services.artist_revenue, artist, period=q.get("period") or "month",
                             start=_date_param(request, "from"), end=_date_param(request, "to"),
                             currency=q.get("currency") or None))


class StaffOverviewView(APIView):
    """Chiffres de l'équipe AGAPY : jour, semaine, mois et classements des artistes sur la période."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        parameters=[
            OpenApiParameter("period", OpenApiTypes.STR, enum=list(services.RANKING_PERIODS)),
            OpenApiParameter("currency", OpenApiTypes.STR, enum=list(services.CURRENCIES)),
        ],
        responses={200: OpenApiTypes.OBJECT}, tags=TAGS,
    )
    def get(self, request):
        q = request.query_params
        return Response(_run(services.staff_overview, period=q.get("period") or "month",
                             currency=q.get("currency") or "XOF"))
