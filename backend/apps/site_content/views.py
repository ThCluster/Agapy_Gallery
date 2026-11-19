from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.accounts.views import PublicView

from . import services
from .models import Page, Partner
from .serializers import (
    ContactSerializer,
    NewsletterSubscribeSerializer,
    NewsletterUnsubscribeSerializer,
    PageSerializer,
    PartnerSerializer,
    StatsSerializer,
)

DetailResponse = inline_serializer("SiteDetailResponse", {"detail": serializers.CharField()})


class ContactThrottle(AnonRateThrottle):
    """5 messages de contact par heure et par adresse IP."""

    scope = "site_contact"
    rate = "5/hour"


class NewsletterThrottle(AnonRateThrottle):
    scope = "site_newsletter"
    rate = "20/hour"


class ContactView(PublicView):
    """Formulaire de contact : le message est enregistré et transmis par e-mail à l'équipe."""

    throttle_classes = [ContactThrottle]

    @extend_schema(request=ContactSerializer, responses={201: DetailResponse}, tags=["Site"])
    def post(self, request):
        s = ContactSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.submit_contact(ip_address=request.META.get("REMOTE_ADDR") or None, **s.validated_data)
        return Response({"detail": "Votre message a bien été envoyé."}, status=status.HTTP_201_CREATED)


class NewsletterSubscribeView(PublicView):
    throttle_classes = [NewsletterThrottle]

    @extend_schema(request=NewsletterSubscribeSerializer, responses={200: DetailResponse}, tags=["Site"])
    def post(self, request):
        s = NewsletterSubscribeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.subscribe(s.validated_data["email"], s.validated_data["language"])
        return Response({"detail": "Inscription à la newsletter enregistrée."})


class NewsletterUnsubscribeView(PublicView):
    throttle_classes = [NewsletterThrottle]

    @extend_schema(request=NewsletterUnsubscribeSerializer, responses={200: DetailResponse}, tags=["Site"])
    def post(self, request):
        s = NewsletterUnsubscribeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if not services.unsubscribe(s.validated_data["token"]):
            raise ValidationError({"token": ["Lien de désinscription invalide."]}, code="invalid_token")
        return Response({"detail": "Vous êtes désinscrit de la newsletter."})


class PartnersView(PublicView):
    @extend_schema(responses={200: PartnerSerializer(many=True)}, tags=["Site"])
    def get(self, request):
        partners = Partner.objects.filter(is_active=True)
        return Response(PartnerSerializer(partners, many=True, context={"request": request}).data)


class PageView(PublicView):
    """Page éditable (terms, about, legal, advertising…), en français ou en anglais (repli sur le français)."""

    @extend_schema(parameters=[OpenApiParameter("lang", enum=["fr", "en"], required=False)],
                   responses={200: PageSerializer}, tags=["Site"])
    def get(self, request, slug):
        page = get_object_or_404(Page, slug=slug, is_published=True)
        return Response(PageSerializer(page.localized(request.query_params.get("lang", "fr"))).data)


class StatsView(PublicView):
    @extend_schema(responses={200: StatsSerializer}, tags=["Site"])
    def get(self, request):
        return Response({"artist_count": services.artist_count()})
