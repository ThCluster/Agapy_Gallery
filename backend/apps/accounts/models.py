"""
Comptes AGAPY-GALLERY.

- Seuls les artistes et fondations ont un compte. Les visiteurs paient sans inscription.
- L'identifiant est le numéro de téléphone avec l'indicatif du pays : un numéro = un compte.
- Les membres de l'équipe AGAPY (administration Django) sont des User avec is_staff,
  sans profil artiste.
"""
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.phone import format_international
from apps.core.regions import region_of

from .managers import UserManager
from .validators import validate_gps


class User(AbstractBaseUser, PermissionsMixin):
    phone = models.CharField(
        "téléphone", max_length=20, unique=True,
        help_text="Format international, ex. +2250700000000. Sert d'identifiant de connexion.",
    )
    email = models.EmailField("e-mail", blank=True)
    is_active = models.BooleanField(
        "actif", default=True,
        help_text="Un compte inactif ne peut pas se connecter (inscription non payée, exclusion).",
    )
    is_staff = models.BooleanField("équipe AGAPY", default=False, help_text="Accès à l'administration.")
    date_joined = models.DateTimeField("inscrit le", default=timezone.now)
    # Incrémenté à chaque changement de mot de passe : invalide tous les jetons déjà émis
    auth_version = models.PositiveIntegerField(default=0, editable=False)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self):
        return self.phone_display

    @property
    def phone_display(self) -> str:
        return format_international(self.phone)


class Civility(models.TextChoices):
    MR = "mr", "Monsieur"
    MRS = "mrs", "Madame"
    ORG = "org", "Raison sociale (fondation ou groupement)"


class ArtistStatus(models.TextChoices):
    PENDING_PAYMENT = "pending_payment", "En attente du paiement d'ouverture"
    ACTIVE = "active", "Actif"
    DORMANT = "dormant", "En veille (abonnement à renouveler)"
    EXCLUDED = "excluded", "Exclu définitivement"


class MomoOperator(models.TextChoices):
    ORANGE = "Orange Money"
    MTN = "MTN MoMo"
    MOOV = "Moov Money"
    WAVE = "Wave"
    AIRTEL = "Airtel Money"
    FREE = "Free Money"


def artist_photo_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"artists/{instance.slug or 'new'}/photo-{timezone.now():%Y%m%d%H%M%S}.{ext}"


class ArtistProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="artist", verbose_name="compte")
    # Identifiant public utilisé dans les adresses du site (/artistes/awa-kone)
    slug = models.SlugField("identifiant public", max_length=80, unique=True)
    status = models.CharField("statut", max_length=20, choices=ArtistStatus, default=ArtistStatus.PENDING_PAYMENT, db_index=True)
    civility = models.CharField("civilité", max_length=3, choices=Civility)

    # Personne physique
    last_name = models.CharField("nom", max_length=100, blank=True)
    first_names = models.CharField("prénoms", max_length=150, blank=True)
    birth_date = models.DateField("date de naissance", null=True, blank=True)
    birth_place = models.CharField("lieu de naissance", max_length=150, blank=True)
    artist_name = models.CharField("nom d'artiste", max_length=150, blank=True)

    # Fondation ou groupement
    org_name = models.CharField("raison sociale", max_length=200, blank=True)
    founded_date = models.DateField("date de création", null=True, blank=True)
    founded_place = models.CharField("lieu de création", max_length=150, blank=True)

    # Coordonnées et présentation
    country = models.CharField("pays", max_length=2)
    city = models.CharField("ville", max_length=120)
    village = models.CharField("village", max_length=120, blank=True)
    gps = models.CharField("coordonnées GPS", max_length=60, blank=True, validators=[validate_gps])
    photo = models.ImageField("photo", upload_to=artist_photo_path, blank=True)
    bio = models.TextField("biographie", blank=True)
    website = models.URLField("site web", blank=True)
    facebook = models.URLField(blank=True)
    instagram = models.URLField(blank=True)

    # Compte de récupération des fonds : mobile money et/ou IBAN
    payout_momo = models.BooleanField("versement mobile money", default=False)
    momo_operator = models.CharField("opérateur", max_length=30, choices=MomoOperator, blank=True)
    momo_number = models.CharField("numéro mobile money", max_length=20, blank=True)
    payout_iban = models.BooleanField("versement bancaire", default=False)
    iban = models.CharField("IBAN", max_length=34, blank=True)
    account_holder = models.CharField("titulaire du compte", max_length=150, blank=True)
    bank_name = models.CharField("banque", max_length=150, blank=True)

    # Modération : liste rouge pendant au moins 3 mois après une œuvre inappropriée
    red_listed_until = models.DateField("sur liste rouge jusqu'au", null=True, blank=True)

    accepted_terms_at = models.DateTimeField("CGU acceptées le", null=True, blank=True)
    activated_at = models.DateTimeField("activé le", null=True, blank=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        verbose_name = "artiste"
        verbose_name_plural = "artistes"
        ordering = ["-created_at"]

    def __str__(self):
        return self.display_name

    @property
    def is_org(self) -> bool:
        return self.civility == Civility.ORG

    @property
    def display_name(self) -> str:
        if self.is_org:
            return self.org_name
        return self.artist_name or f"{self.first_names} {self.last_name}".strip()

    @property
    def region(self) -> str:
        return region_of(self.country)

    @property
    def is_red_listed(self) -> bool:
        return bool(self.red_listed_until and self.red_listed_until >= timezone.localdate())

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._unique_slug()
        super().save(*args, **kwargs)

    def _unique_slug(self) -> str:
        base = slugify(self.display_name)[:70] or "artiste"
        slug, n = base, 2
        while ArtistProfile.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug, n = f"{base}-{n}", n + 1
        return slug


class PasswordResetCode(models.Model):
    """Code à 6 chiffres envoyé par SMS (mot de passe oublié). Seule son empreinte est stockée."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reset_codes")
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "code de réinitialisation"
        verbose_name_plural = "codes de réinitialisation"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]
