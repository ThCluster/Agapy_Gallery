"""
Publicité sur le site : clips de 30 s sur l'accueil (payants, ouverts à tous),
espaces publicitaires gérés par l'équipe et TV en ligne.
"""
from django.db import models
from django.utils import timezone

from apps.core.pricing import CLIP_MAX_SECONDS
from apps.core.uploads import SafeImageField


def clip_upload_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "mp4"
    return f"clips/{timezone.now():%Y/%m}/clip-{timezone.now():%Y%m%d%H%M%S%f}.{ext}"


def clip_poster_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"clips/{timezone.now():%Y/%m}/poster-{timezone.now():%Y%m%d%H%M%S%f}.{ext}"


class ClipStatus(models.TextChoices):
    AWAITING_PAYMENT = "awaiting_payment", "En attente du paiement"
    PENDING_REVIEW = "pending_review", "Payé, en attente de validation"
    QUEUED = "queued", "Payé, en file d'attente"
    PLAYING = "playing", "En diffusion"
    FINISHED = "finished", "Diffusion terminée"
    REJECTED = "rejected", "Rejeté (inapproprié)"


class Clip(models.Model):
    """
    Clip de 30 s au plus, diffusé 24 h sur l'accueil (50 clips à la fois au plus).
    Après paiement il attend la validation de l'équipe, puis entre dans la file de diffusion.
    """

    title = models.CharField("titre", max_length=150)
    advertiser = models.CharField("annonceur", max_length=150)
    contact_phone = models.CharField("téléphone de contact", max_length=20, blank=True)
    contact_email = models.EmailField("e-mail de contact", blank=True)
    video = models.FileField("vidéo", upload_to=clip_upload_path)
    # JPEG / PNG / WebP vérifiés puis ré-encodés (métadonnées supprimées) : voir apps.core.uploads
    poster = SafeImageField("affiche", upload_to=clip_poster_path, blank=True)
    duration_seconds = models.PositiveSmallIntegerField("durée déclarée (s)", help_text=f"{CLIP_MAX_SECONDS} s au plus.")
    # Renseigné si le clip est commandé depuis un compte artiste
    artist = models.ForeignKey("accounts.ArtistProfile", on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="clips", verbose_name="artiste")

    status = models.CharField("statut", max_length=20, choices=ClipStatus, default=ClipStatus.AWAITING_PAYMENT,
                              db_index=True)
    rejection_reason = models.CharField("motif du rejet", max_length=255, blank=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    paid_at = models.DateTimeField("payé le", null=True, blank=True)
    starts_at = models.DateTimeField("diffusé à partir du", null=True, blank=True)
    ends_at = models.DateTimeField("diffusé jusqu'au", null=True, blank=True)

    class Meta:
        verbose_name = "clip"
        verbose_name_plural = "clips"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "paid_at"])]

    def __str__(self):
        return f"{self.title} — {self.advertiser}"


class AdFormat(models.TextChoices):
    BANNER = "banner_468x60", "Bannière 468 × 60"
    SKYSCRAPER = "skyscraper_160x600", "Gratte-ciel 160 × 600"
    BUTTON = "button_88x31", "Bouton 88 × 31"
    BILLBOARD = "billboard_336x280", "Pavé 336 × 280"
    SITE_SKIN = "site_skin", "Habillage du site"


class AdCampaign(models.Model):
    """Campagne d'un annonceur sur un espace publicitaire, saisie par l'équipe dans l'administration."""

    advertiser = models.CharField("annonceur", max_length=150)
    format = models.CharField("format", max_length=20, choices=AdFormat, db_index=True)
    image = models.ImageField("visuel", upload_to="ads/%Y/%m/")
    link_url = models.URLField("lien", blank=True)
    alt_text = models.CharField("texte alternatif", max_length=200, blank=True)
    starts_at = models.DateTimeField("début", default=timezone.now)
    ends_at = models.DateTimeField("fin", null=True, blank=True, help_text="Vide : sans date de fin.")
    is_active = models.BooleanField("active", default=True)
    weight = models.PositiveSmallIntegerField("poids", default=1,
                                              help_text="Plus le poids est élevé, plus la campagne est affichée souvent.")
    created_at = models.DateTimeField("créée le", auto_now_add=True)

    class Meta:
        verbose_name = "campagne publicitaire"
        verbose_name_plural = "campagnes publicitaires"
        ordering = ["format", "-weight", "-starts_at"]

    def __str__(self):
        return f"{self.advertiser} ({self.get_format_display()})"


class LiveStream(models.Model):
    """Émission de la TV en ligne (direct intégré depuis YouTube, Facebook…)."""

    title = models.CharField("titre", max_length=200)
    description = models.TextField("description", blank=True)
    embed_url = models.URLField("adresse d'intégration", max_length=500)
    starts_at = models.DateTimeField("début")
    ends_at = models.DateTimeField("fin", null=True, blank=True)
    is_live = models.BooleanField("en direct", default=False)

    class Meta:
        verbose_name = "émission TV en ligne"
        verbose_name_plural = "TV en ligne"
        ordering = ["starts_at"]

    def __str__(self):
        return self.title
