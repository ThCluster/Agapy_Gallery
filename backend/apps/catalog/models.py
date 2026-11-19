"""
Catalogue AGAPY-GALLERY : galeries des artistes et œuvres publiées.

- Chaque artiste a une galerie (une « villa » sur la grande avenue de la ville 3D), créée à la volée.
  La visite peut être gratuite, éventuellement jusqu'à une date choisie par l'artiste (p. 10).
- L'ouverture du compte inclut une publication gratuite ; les suivantes sont payantes (p. 9).
- Toute publication passe par la modération de l'équipe AGAPY avant d'être visible (p. 13).
"""
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import IntegrityError, models, transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import ArtistProfile
from apps.core.uploads import SafeImageField

ARTWORK_IMAGE_MAX_BYTES = 10 * 1024 * 1024
EXCERPT_MAX_BYTES = 20 * 1024 * 1024
EXCERPT_MAX_SECONDS = 30
EXCERPT_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "aac", "mp4", "webm", "mov"]


class Gallery(models.Model):
    artist = models.OneToOneField(ArtistProfile, on_delete=models.CASCADE, related_name="gallery", verbose_name="artiste")
    address_number = models.PositiveIntegerField(
        "numéro sur l'avenue", unique=True, editable=False,
        help_text="Adresse de la galerie sur la grande avenue de la ville 3D, attribuée automatiquement.",
    )
    is_free = models.BooleanField("visite gratuite", default=False)
    free_until = models.DateField("gratuite jusqu'au", null=True, blank=True,
                                  help_text="Facultatif : la gratuité peut être limitée dans le temps.")
    free_publication_used = models.BooleanField(
        "publication gratuite utilisée", default=False,
        help_text="L'ouverture du compte inclut une publication gratuite.",
    )
    created_at = models.DateTimeField("créée le", auto_now_add=True)
    updated_at = models.DateTimeField("modifiée le", auto_now=True)

    class Meta:
        verbose_name = "galerie"
        verbose_name_plural = "galeries"
        ordering = ["address_number"]

    def __str__(self):
        return f"N° {self.address_number} — {self.artist.display_name}"

    @property
    def currently_free(self) -> bool:
        """Vrai si la visite est gratuite aujourd'hui (utilisé par le module paiements)."""
        return self.is_free and (self.free_until is None or self.free_until >= timezone.localdate())

    def save(self, *args, **kwargs):
        if self.address_number is not None:
            return super().save(*args, **kwargs)
        # Numéro suivant sur l'avenue ; on réessaie si deux galeries sont créées en même temps
        for _ in range(5):
            self.address_number = (Gallery.objects.aggregate(m=Max("address_number"))["m"] or 0) + 1
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError:
                if Gallery.objects.filter(artist_id=self.artist_id).exists():
                    raise
                self.pk = None
        raise IntegrityError("Impossible d'attribuer un numéro de galerie.")

    @classmethod
    def for_artist(cls, artist: ArtistProfile) -> "Gallery":
        try:
            return artist.gallery
        except cls.DoesNotExist:
            gallery, _ = cls.objects.get_or_create(artist=artist)
            return gallery


class Discipline(models.TextChoices):
    PAINTING = "peinture", "Peinture"
    PHOTOGRAPHY = "photographie", "Photographie"
    SCULPTURE = "sculpture", "Sculpture"
    OTHER = "autre", "Autre"


class Frame(models.TextChoices):
    """Cadres virtuels proposés pour embellir les œuvres (p. 4), mêmes identifiants que le frontend."""

    BLACK = "black", "Noir"
    WOOD = "wood", "Bois"
    GOLD = "gold", "Doré"
    WHITE = "white", "Blanc"
    NONE = "none", "Sans cadre"


class ArtworkStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    AWAITING_PAYMENT = "awaiting_payment", "En attente du paiement"
    PENDING_REVIEW = "pending_review", "En attente de validation"
    PUBLISHED = "published", "Publiée"
    REJECTED = "rejected", "Refusée"
    REMOVED = "removed", "Retirée par l'équipe"


def artwork_image_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"artworks/{instance.artist.slug}/{timezone.now():%Y%m%d%H%M%S%f}.{ext}"


def artwork_excerpt_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "mp4"
    return f"artworks/{instance.artist.slug}/extrait-{timezone.now():%Y%m%d%H%M%S%f}.{ext}"


class PublicArtworkQuerySet(models.QuerySet):
    def visible(self):
        """Œuvres publiées d'artistes visibles (ni exclus, ni en attente d'ouverture)."""
        from .services import visible_artists_q
        return self.filter(status=ArtworkStatus.PUBLISHED).filter(visible_artists_q("artist__"))


class Artwork(models.Model):
    artist = models.ForeignKey(ArtistProfile, on_delete=models.CASCADE, related_name="artworks", verbose_name="artiste")
    slug = models.SlugField("identifiant public", max_length=90, unique=True)
    title = models.CharField("titre", max_length=200)
    summary = models.TextField("résumé")
    technique = models.CharField("technique", max_length=150)
    discipline = models.CharField("discipline", max_length=20, choices=Discipline, default=Discipline.PAINTING, db_index=True)
    height_cm = models.DecimalField("hauteur (cm)", max_digits=7, decimal_places=1,
                                    validators=[MinValueValidator(0)])
    width_cm = models.DecimalField("largeur (cm)", max_digits=7, decimal_places=1,
                                   validators=[MinValueValidator(0)])
    # JPEG / PNG / WebP vérifiés puis ré-encodés (métadonnées EXIF/GPS supprimées) : voir apps.core.uploads
    image = SafeImageField("image", upload_to=artwork_image_path, max_bytes=ARTWORK_IMAGE_MAX_BYTES)
    excerpt = models.FileField(
        "extrait (30 s max)", upload_to=artwork_excerpt_path, blank=True,
        validators=[FileExtensionValidator(EXCERPT_EXTENSIONS)],
    )
    excerpt_duration = models.PositiveSmallIntegerField(
        "durée de l'extrait (s)", null=True, blank=True, validators=[MaxValueValidator(EXCERPT_MAX_SECONDS)],
    )
    frame = models.CharField("cadre", max_length=10, choices=Frame, default=Frame.NONE)

    # Auteur (artiste ou fondation) et bureau de protection des droits (ex. BURIDA en Côte d'Ivoire)
    author_name = models.CharField("nom de l'artiste ou de la fondation", max_length=200, blank=True)
    author_contact = models.CharField("coordonnées de l'artiste", max_length=255, blank=True)
    copyright_office = models.CharField("bureau de protection", max_length=200)
    copyright_contact = models.CharField("coordonnées du bureau de protection", max_length=255, blank=True)
    owner_certified = models.BooleanField(
        "propriété certifiée", default=False,
        help_text="L'artiste certifie être propriétaire de l'œuvre (obligatoire).",
    )

    # Réservé : sans effet pour l'instant (la gratuité se règle au niveau de la galerie, Gallery.is_free)
    is_free = models.BooleanField("visite gratuite", default=False)
    recommended = models.BooleanField("recommandée", default=False, db_index=True)
    team_favorite = models.BooleanField("coup de cœur de l'équipe", default=False, db_index=True)

    status = models.CharField("statut", max_length=20, choices=ArtworkStatus, default=ArtworkStatus.DRAFT, db_index=True)
    publication_settled = models.BooleanField(
        "droit de publication réglé", default=False, editable=False,
        help_text="Publication gratuite utilisée ou paiement reçu : une nouvelle soumission ne sera pas refacturée.",
    )
    moderation_reason = models.TextField("motif du refus ou du retrait", blank=True)
    submitted_at = models.DateTimeField("soumise le", null=True, blank=True)
    moderated_at = models.DateTimeField("modérée le", null=True, blank=True)
    published_at = models.DateTimeField("publiée le", null=True, blank=True)
    view_count = models.PositiveIntegerField("vues", default=0, editable=False)
    created_at = models.DateTimeField("créée le", auto_now_add=True)
    updated_at = models.DateTimeField("modifiée le", auto_now=True)

    objects = PublicArtworkQuerySet.as_manager()

    class Meta:
        verbose_name = "œuvre"
        verbose_name_plural = "œuvres"
        ordering = ["-published_at", "-created_at"]
        indexes = [models.Index(fields=["artist", "status"])]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._unique_slug()
        super().save(*args, **kwargs)

    def _unique_slug(self) -> str:
        base = slugify(self.title)[:80] or "oeuvre"
        slug, n = base, 2
        while Artwork.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug, n = f"{base}-{n}", n + 1
        return slug
