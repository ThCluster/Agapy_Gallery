from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.payments.serializers import PaymentSummarySerializer  # noqa: F401  (réexporté)

from apps.core.uploads import ImageValidator, MediaValidator
from apps.payments.models import Method

from .models import (
    ARTWORK_IMAGE_MAX_BYTES,
    EXCERPT_EXTENSIONS,
    EXCERPT_MAX_BYTES,
    EXCERPT_MAX_SECONDS,
    Artwork,
    ArtworkStatus,
    Gallery,
)


def _size(obj) -> list[float]:
    return [float(obj.height_cm), float(obj.width_cm)]


# ---------------------------------------------------------------------------
# Espace artiste
# ---------------------------------------------------------------------------
class MyArtworkSerializer(serializers.ModelSerializer):
    """Œuvre de l'artiste connecté. Toutes les informations restent modifiables (multipart)."""

    id = serializers.CharField(source="slug", read_only=True)
    size = serializers.SerializerMethodField()
    image = serializers.ImageField()
    owner_certified = serializers.BooleanField(required=False)
    excerpt_duration = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    is_free = serializers.BooleanField(read_only=True, help_text="Réservé : sans effet pour l'instant.")

    class Meta:
        model = Artwork
        fields = [
            "id", "slug", "title", "summary", "technique", "discipline", "height_cm", "width_cm", "size",
            "image", "excerpt", "excerpt_duration", "frame",
            "author_name", "author_contact", "copyright_office", "copyright_contact", "owner_certified",
            "is_free", "recommended", "team_favorite",
            "status", "publication_settled", "moderation_reason",
            "submitted_at", "published_at", "view_count", "created_at", "updated_at",
        ]
        read_only_fields = [
            "slug", "recommended", "team_favorite", "status", "publication_settled", "moderation_reason",
            "submitted_at", "published_at", "view_count", "created_at", "updated_at",
        ]
        extra_kwargs = {
            "height_cm": {"min_value": Decimal("0.1")}, "width_cm": {"min_value": Decimal("0.1")},
            "excerpt": {"validators": []},  # vérifié par validate_excerpt (extension et signature)
        }

    def get_size(self, obj) -> list[float]:
        return _size(obj)

    def validate_image(self, image):
        # JPEG / PNG / WebP réels, 10 Mo au plus : codes file_type, file_too_large, image_too_large
        ImageValidator(ARTWORK_IMAGE_MAX_BYTES)(image)
        return image

    def validate_excerpt(self, excerpt):
        # Signature du fichier conforme à son extension, 20 Mo au plus : codes file_type, file_too_large
        if excerpt:
            MediaValidator(EXCERPT_EXTENSIONS, EXCERPT_MAX_BYTES, label="L'extrait")(excerpt)
        return excerpt

    def validate_excerpt_duration(self, value):
        if value is not None and value > EXCERPT_MAX_SECONDS:
            raise serializers.ValidationError("L'extrait ne doit pas dépasser 30 secondes.", code="excerpt_too_long")
        return value

    def validate_owner_certified(self, value):
        if not value:
            raise serializers.ValidationError("Vous devez certifier être propriétaire de l'œuvre.",
                                              code="owner_certification_required")
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("owner_certified"):
            raise serializers.ValidationError(
                {"owner_certified": "Vous devez certifier être propriétaire de l'œuvre."},
                code="owner_certification_required")
        excerpt = attrs.get("excerpt", self.instance.excerpt if self.instance else None)
        duration = attrs.get("excerpt_duration", self.instance.excerpt_duration if self.instance else None)
        if excerpt and duration is None:
            raise serializers.ValidationError(
                {"excerpt_duration": "Indiquez la durée de l'extrait (30 secondes maximum)."},
                code="excerpt_duration_required")
        if self.instance is not None and self.instance.status == ArtworkStatus.REMOVED:
            raise serializers.ValidationError(
                {"detail": "Cette œuvre a été retirée par l'équipe AGAPY."}, code="artwork_removed")
        return attrs


class SubmitSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Method.choices, required=False,
                                     help_text="Inutile si la publication gratuite de l'ouverture est disponible.")



class SubmitResponseSerializer(serializers.Serializer):
    artwork = MyArtworkSerializer()
    payment = PaymentSummarySerializer(allow_null=True)
    action = serializers.DictField(allow_null=True)
    free_publication = serializers.BooleanField()


class MyGallerySerializer(serializers.ModelSerializer):
    address = serializers.IntegerField(source="address_number", read_only=True)
    currently_free = serializers.BooleanField(read_only=True)

    class Meta:
        model = Gallery
        fields = ["address", "is_free", "free_until", "currently_free", "free_publication_used"]
        read_only_fields = ["free_publication_used"]

    def validate_free_until(self, value):
        if value and value < timezone.localdate():
            raise serializers.ValidationError("La date de fin de gratuité est déjà passée.", code="date_past")
        return value


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------
class PublicArtworkSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug")
    artist_id = serializers.CharField(source="artist.slug")
    artist_name = serializers.CharField(source="artist.display_name")
    size = serializers.SerializerMethodField()

    class Meta:
        model = Artwork
        fields = [
            "id", "title", "artist_id", "artist_name", "summary", "technique", "discipline", "size",
            "height_cm", "width_cm", "image", "excerpt", "excerpt_duration", "frame",
            "author_name", "copyright_office", "is_free", "recommended", "team_favorite",
            "published_at", "view_count",
        ]
        read_only_fields = fields

    def get_size(self, obj) -> list[float]:
        return _size(obj)


class PublicArtistSerializer(serializers.Serializer):
    """Carte d'un artiste (listes, recherche). Miroir du type Artist du frontend."""

    id = serializers.CharField(source="slug")
    name = serializers.CharField(source="display_name")
    discipline = serializers.SerializerMethodField()
    city = serializers.CharField()
    country = serializers.CharField()
    address = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()
    photo = serializers.ImageField()
    free = serializers.SerializerMethodField()
    free_until = serializers.SerializerMethodField()
    artwork_count = serializers.SerializerMethodField()
    visits = serializers.SerializerMethodField(help_text="Visites réelles de la galerie (gratuites et payantes).")

    def _works(self, obj) -> list:
        works = getattr(obj, "published_works", None)
        if works is None:
            works = list(Artwork.objects.visible().filter(artist=obj).order_by("-recommended", "-published_at"))
            obj.published_works = works
        return works

    def _gallery(self, obj) -> Gallery:
        return Gallery.for_artist(obj)

    def get_discipline(self, obj) -> str | None:
        works = self._works(obj)
        if not works:
            return None
        counts: dict[str, int] = {}
        for w in works:
            counts[w.discipline] = counts.get(w.discipline, 0) + 1
        return max(counts, key=counts.get)

    def get_address(self, obj) -> int:
        return self._gallery(obj).address_number

    def get_cover(self, obj) -> str | None:
        works = self._works(obj)
        if not works:
            return None
        # URL relative (/media/…), comme les champs image : passe par le proxy du frontend
        return works[0].image.url

    def get_free(self, obj) -> bool:
        return self._gallery(obj).currently_free

    def get_free_until(self, obj) -> str | None:
        gallery = self._gallery(obj)
        return gallery.free_until.isoformat() if gallery.currently_free and gallery.free_until else None

    def get_artwork_count(self, obj) -> int:
        return len(self._works(obj))

    def get_visits(self, obj) -> int:
        """Visites enregistrées (VisitLog), annotées par la vue (visit_total) ou comptées ici."""
        total = getattr(obj, "visit_total", None)
        if total is None:
            from apps.payments.models import VisitLog
            total = VisitLog.objects.filter(artist=obj).count()
        return total


class PublicArtistDetailSerializer(PublicArtistSerializer):
    bio = serializers.CharField()
    member_since = serializers.SerializerMethodField()
    copyright_office = serializers.SerializerMethodField()
    socials = serializers.SerializerMethodField()
    artworks = serializers.SerializerMethodField()

    def get_member_since(self, obj) -> int:
        return (obj.activated_at or obj.created_at).year

    def get_copyright_office(self, obj) -> str:
        works = sorted(self._works(obj), key=lambda w: w.published_at or w.created_at, reverse=True)
        return works[0].copyright_office if works else ""

    def get_socials(self, obj) -> list[dict]:
        links = [("Instagram", obj.instagram), ("Facebook", obj.facebook), ("Site web", obj.website)]
        return [{"label": label, "url": url} for label, url in links if url]

    def get_artworks(self, obj) -> list[dict]:
        return PublicArtworkSerializer(self._works(obj), many=True, context=self.context).data


class FrameSerializer(serializers.Serializer):
    id = serializers.CharField()
    label = serializers.CharField()


class SearchResponseSerializer(serializers.Serializer):
    found = serializers.BooleanField()
    code = serializers.CharField(allow_blank=True)
    detail = serializers.CharField(allow_blank=True)
    artists = PublicArtistSerializer(many=True)
    artworks = PublicArtworkSerializer(many=True)
