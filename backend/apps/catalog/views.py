import hashlib
import mimetypes
import posixpath

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.utils.cache import patch_vary_headers

from django.core.cache import cache
from django.db.models import F, Prefetch
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.core.net import client_ip
from apps.core.pagination import RelativePageNumberPagination
from apps.payments.providers import ProviderError

from . import access, services
from .authentication import OptionalJWTAuthentication
from .models import Artwork, ArtworkStatus, Discipline, Frame, Gallery
from .serializers import (
    FrameSerializer,
    MyArtworkSerializer,
    MyGallerySerializer,
    PaymentSummarySerializer,
    PublicArtistDetailSerializer,
    PublicArtistSerializer,
    PublicArtworkSerializer,
    SearchResponseSerializer,
    SubmitResponseSerializer,
    SubmitSerializer,
)


# Une vue d'œuvre n'est comptée qu'une fois par visiteur (adresse IP) et par œuvre sur cette durée
ARTWORK_VIEW_DEDUP_SECONDS = 6 * 3600

# Tris proposés sur la liste des artistes (?ordering=)
ARTIST_ORDERINGS = {
    "-visits": ("-visit_total", "gallery__address_number"),
    "visits": ("visit_total", "gallery__address_number"),
    "-views": ("-view_total", "gallery__address_number"),
    "views": ("view_total", "gallery__address_number"),
}


class CatalogPagination(RelativePageNumberPagination):
    """Liens next / previous relatifs (/api/v1/…), voir apps.core.pagination."""

    page_size = 24


class SearchThrottle(AnonRateThrottle):
    scope = "catalog_search"
    rate = "60/min"


class IsArtist(BasePermission):
    message = "Réservé aux artistes."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and hasattr(request.user, "artist"))


# ---------------------------------------------------------------------------
# Espace artiste
# ---------------------------------------------------------------------------
class ArtistSpaceMixin:
    permission_classes = [IsAuthenticated, IsArtist]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @property
    def artist(self):
        return self.request.user.artist


@extend_schema(tags=["Espace artiste — œuvres"])
class MyArtworkListView(ArtistSpaceMixin, generics.ListCreateAPIView):
    """Mes œuvres (tous statuts) ; création d'une œuvre en brouillon."""

    serializer_class = MyArtworkSerializer
    pagination_class = CatalogPagination

    def get_queryset(self):
        return Artwork.objects.filter(artist=self.artist).select_related("artist").order_by("-created_at")

    def perform_create(self, serializer):
        data = services.prepare_new_artwork(self.artist, dict(serializer.validated_data))
        serializer.validated_data.update(data)
        serializer.save(artist=self.artist)


@extend_schema(tags=["Espace artiste — œuvres"])
class MyArtworkDetailView(ArtistSpaceMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MyArtworkSerializer
    lookup_field = "slug"
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Artwork.objects.filter(artist=self.artist).select_related("artist")

    def perform_update(self, serializer):
        changed = {k for k, v in serializer.validated_data.items() if getattr(serializer.instance, k) != v}
        services.check_artwork_update(serializer.instance, changed)
        artwork = serializer.save()
        services.apply_artwork_changes(artwork, changed)

    def perform_destroy(self, instance):
        if instance.status == ArtworkStatus.REMOVED:
            raise PermissionDenied("Une œuvre retirée par l'équipe ne peut pas être supprimée.", code="artwork_removed")
        instance.delete()


class MyArtworkSubmitView(ArtistSpaceMixin, APIView):
    """
    Soumet l'œuvre à la modération. Utilise la publication gratuite de l'ouverture si elle est
    disponible, sinon crée le paiement du droit de publication (`action` dit au frontend quoi faire).
    """

    parser_classes = [JSONParser, FormParser, MultiPartParser]

    @extend_schema(request=SubmitSerializer, responses={200: SubmitResponseSerializer}, tags=["Espace artiste — œuvres"])
    def post(self, request, slug):
        artwork = get_object_or_404(Artwork.objects.select_related("artist__user"), artist=self.artist, slug=slug)
        s = SubmitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            result = services.submit_artwork(artwork, s.validated_data.get("method"), request.user)
        except ProviderError as exc:
            raise ValidationError({"method": [exc.message]}, code=exc.code)
        payment = result["payment"]
        return Response({
            "artwork": MyArtworkSerializer(result["artwork"], context={"request": request}).data,
            "payment": PaymentSummarySerializer(payment).data if payment else None,
            "action": result["action"],
            "free_publication": result["free_publication"],
        }, status=status.HTTP_200_OK)


@extend_schema(tags=["Espace artiste — galerie"])
class MyGalleryView(ArtistSpaceMixin, generics.RetrieveUpdateAPIView):
    """Ma galerie : visite gratuite ou payante, éventuellement gratuite jusqu'à une date."""

    serializer_class = MyGallerySerializer
    http_method_names = ["get", "patch", "head", "options"]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_object(self):
        return Gallery.for_artist(self.artist)


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------
class PublicMixin:
    permission_classes = [AllowAny]
    # Reconnaît l'artiste / le staff connecté (accès à la pleine résolution) sans jamais refuser la requête
    authentication_classes = [OptionalJWTAuthentication]

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        # Le contenu (image verrouillée ou non) dépend du droit de visite et du compte connecté
        patch_vary_headers(response, ("Authorization", access.VISIT_TOKEN_HEADER))
        return response


def _published_prefetch():
    return Prefetch("artworks", queryset=Artwork.objects.visible().select_related("artist__gallery").order_by("-recommended", "-published_at"),
                    to_attr="published_works")


def _artists_queryset():
    return services.with_audience(
        services.public_artists().select_related("user").prefetch_related(_published_prefetch()))


@extend_schema(
    tags=["Catalogue"],
    parameters=[
        OpenApiParameter("q", OpenApiTypes.STR, description="Nom de l'artiste"),
        OpenApiParameter("discipline", OpenApiTypes.STR, enum=Discipline.values),
        OpenApiParameter("country", OpenApiTypes.STR, description="Code pays ISO, ex. CI"),
        OpenApiParameter("free", OpenApiTypes.BOOL, description="Galeries en visite gratuite uniquement"),
        OpenApiParameter("ordering", OpenApiTypes.STR, enum=list(ARTIST_ORDERINGS),
                         description="-visits : les plus visités (visites réelles) ; -views : vues de leurs œuvres. "
                                     "Par défaut : ordre des adresses sur l'avenue."),
    ],
)
class PublicArtistListView(PublicMixin, generics.ListAPIView):
    serializer_class = PublicArtistSerializer
    pagination_class = CatalogPagination

    def get_queryset(self):
        qs = _artists_queryset()
        p = self.request.query_params
        if p.get("q"):
            qs = qs.filter(services.name_q(services.words_of(p["q"])))
        if p.get("discipline"):
            qs = qs.filter(artworks__status=ArtworkStatus.PUBLISHED, artworks__discipline=p["discipline"]).distinct()
        if p.get("country"):
            qs = qs.filter(country__iexact=p["country"])
        if p.get("free") in ("1", "true", "True"):
            qs = qs.filter(services.free_gallery_q())
        ordering = ARTIST_ORDERINGS.get(p.get("ordering", ""), ("gallery__address_number",))
        return qs.order_by(*ordering, "-created_at")


@extend_schema(tags=["Catalogue"])
class PublicArtistDetailView(PublicMixin, generics.RetrieveAPIView):
    """Profil public d'un artiste : galerie, œuvres publiées, bureau de protection, réseaux sociaux."""

    serializer_class = PublicArtistDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return _artists_queryset()


@extend_schema(
    tags=["Catalogue"],
    parameters=[
        OpenApiParameter("q", OpenApiTypes.STR, description="Titre de l'œuvre ou nom de l'artiste"),
        OpenApiParameter("artist", OpenApiTypes.STR, description="Identifiant public de l'artiste"),
        OpenApiParameter("discipline", OpenApiTypes.STR, enum=Discipline.values),
        OpenApiParameter("recommended", OpenApiTypes.BOOL),
        OpenApiParameter("team_favorite", OpenApiTypes.BOOL),
        OpenApiParameter("free_gallery", OpenApiTypes.BOOL,
                         description="Œuvres dont la galerie est en visite gratuite aujourd'hui"),
    ],
)
class PublicArtworkListView(PublicMixin, generics.ListAPIView):
    serializer_class = PublicArtworkSerializer
    pagination_class = CatalogPagination

    def get_queryset(self):
        qs = Artwork.objects.visible().select_related("artist__gallery")
        p = self.request.query_params
        if p.get("q"):
            words = services.words_of(p["q"])
            qs = qs.filter(services.title_q(words) | services.name_q(words, "artist__"))
        if p.get("artist"):
            qs = qs.filter(artist__slug=p["artist"])
        if p.get("discipline"):
            qs = qs.filter(discipline=p["discipline"])
        if p.get("recommended") in ("1", "true", "True"):
            qs = qs.filter(recommended=True)
        if p.get("team_favorite") in ("1", "true", "True"):
            qs = qs.filter(team_favorite=True)
        if p.get("free_gallery") in ("1", "true", "True"):
            qs = qs.filter(services.free_gallery_q("artist__"))
        return qs.order_by("-published_at")


@extend_schema(tags=["Catalogue"])
class PublicArtworkDetailView(PublicMixin, generics.RetrieveAPIView):
    """Détail d'une œuvre publiée ; la vue est comptée une fois par visiteur et par œuvre toutes les 6 heures."""

    serializer_class = PublicArtworkSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Artwork.objects.visible().select_related("artist__gallery")

    def retrieve(self, request, *args, **kwargs):
        artwork = self.get_object()
        digest = hashlib.sha256(f"{artwork.pk}:{client_ip(request)}".encode()).hexdigest()
        if cache.add(f"artwork-view:{digest}", 1, timeout=ARTWORK_VIEW_DEDUP_SECONDS):
            Artwork.objects.filter(pk=artwork.pk).update(view_count=F("view_count") + 1)
            artwork.refresh_from_db(fields=["view_count"])
        return Response(self.get_serializer(artwork).data)


class ArtworkFileView(PublicMixin, APIView):
    """
    Fichier pleine résolution d'une œuvre publiée, servi seulement si la galerie est gratuite, si la
    requête porte un droit de visite valide pour cet artiste (en-tête X-Visit-Token ou ?visit_token=),
    ou pour l'artiste propriétaire et le staff (connectés, ou URL signée ?sig= remise par l'API).
    Sinon 403 : code visit_required (aucun droit) ou visit_token_invalid (jeton invalide, expiré, autre artiste).
    """

    kind = "image"

    @extend_schema(
        tags=["Catalogue"],
        parameters=[
            OpenApiParameter("visit_token", OpenApiTypes.STR,
                             description="Droit de visite, pour les balises <img>/<video> et textures 3D "
                                         "(sinon en-tête X-Visit-Token)"),
            OpenApiParameter("sig", OpenApiTypes.STR, description="Signature remise par l'API à l'artiste / au staff"),
        ],
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY, 403: None, 404: None},
    )
    def get(self, request, slug):
        artwork = self._artwork(request, slug)
        field_file = getattr(artwork, self.kind)
        if not field_file:
            raise NotFound("Aucun fichier pour cette œuvre.", code="not_found")
        if access.access_reason(request, artwork, self.kind) is None:
            if access.visit_status(request, artwork.artist) == "invalid":
                raise PermissionDenied("Droit de visite invalide ou expiré.", code="visit_token_invalid")
            raise PermissionDenied("Le droit de visite de cette galerie est nécessaire.", code="visit_required")
        return self._file_response(field_file)

    def _artwork(self, request, slug):
        artwork = Artwork.objects.select_related("artist__gallery").filter(slug=slug).first()
        if artwork is None:
            raise NotFound()
        if Artwork.objects.visible().filter(pk=artwork.pk).exists():
            return artwork
        # Œuvre non publiée (brouillon, en modération…) : seuls l'artiste et le staff y accèdent
        if access.is_owner_or_staff(request, artwork) or access.signature_valid(
                request.GET.get(access.SIGNATURE_PARAM, ""), artwork.slug, self.kind):
            return artwork
        raise NotFound()

    def _file_response(self, field_file):
        name = field_file.name
        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        accel = getattr(settings, "MEDIA_ACCEL_REDIRECT_PREFIX", "")
        if accel:
            # Derrière nginx : nginx envoie le fichier depuis une location « internal », Django ne fait que vérifier
            response = HttpResponse(content_type=content_type)
            response["X-Accel-Redirect"] = posixpath.join(accel, name)
        else:
            try:
                handle = field_file.storage.open(name, "rb")
            except OSError:
                raise NotFound("Fichier introuvable.", code="not_found")
            response = FileResponse(handle, content_type=content_type)
        response["Cache-Control"] = "private, max-age=3600"
        response["Content-Disposition"] = "inline"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ArtworkImageView(ArtworkFileView):
    """Image pleine résolution d'une œuvre (protégée par le droit de visite)."""

    kind = "image"


class ArtworkExcerptView(ArtworkFileView):
    """Extrait audio / vidéo d'une œuvre (protégé par le droit de visite)."""

    kind = "excerpt"


@extend_schema(tags=["Catalogue"])
class FreeGalleryListView(PublicArtistListView):
    """Galeries en visite gratuite aujourd'hui."""

    def get_queryset(self):
        return super().get_queryset().filter(services.free_gallery_q())


class FrameListView(PublicMixin, APIView):
    """Cadres virtuels proposés aux artistes."""

    @extend_schema(responses={200: FrameSerializer(many=True)}, tags=["Catalogue"])
    def get(self, request):
        return Response([{"id": value, "label": label} for value, label in Frame.choices])


class SearchView(PublicMixin, APIView):
    """
    Recherche par nom d'artiste (`artist`), par titre d'œuvre (`title`), les deux combinés,
    ou texte libre (`q`). Si rien n'est trouvé : `found=false` et `code` artist_not_found / artwork_not_found.
    """

    throttle_classes = [SearchThrottle]

    @extend_schema(
        parameters=[
            OpenApiParameter("q", OpenApiTypes.STR),
            OpenApiParameter("artist", OpenApiTypes.STR, description="Nom de l'artiste"),
            OpenApiParameter("title", OpenApiTypes.STR, description="Titre de l'œuvre"),
        ],
        responses={200: SearchResponseSerializer},
        tags=["Catalogue"],
    )
    def get(self, request):
        p = request.query_params
        q, artist, title = (p.get(k, "").strip()[:100] for k in ("q", "artist", "title"))
        if not (q or artist or title):
            raise ValidationError({"q": "Saisissez un nom d'artiste ou un titre d'œuvre."}, code="required")
        result = services.search(q=q, artist=artist, title=title)
        ctx = {"request": request}
        return Response({
            "found": result["found"],
            "code": result["code"],
            "detail": result["detail"],
            "artists": PublicArtistSerializer(result["artists"], many=True, context=ctx).data,
            "artworks": PublicArtworkSerializer(result["artworks"], many=True, context=ctx).data,
        })
