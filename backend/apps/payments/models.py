"""
Paiements AGAPY-GALLERY.

Un Payment = une facture payée (ou à payer) par carte, mobile money ou Compte d'Avoir.
Chaque module crée ses paiements avec services.create_payment() et déclare ce qu'il faut
faire une fois le paiement confirmé avec @registry.on_paid("<purpose>").
"""
import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.core.regions import Region


class Purpose(models.TextChoices):
    SIGNUP = "signup", "Ouverture de compte"
    RENEWAL = "renewal", "Renouvellement annuel"
    PUBLICATION = "publication", "Publication d'une œuvre"
    VISIT = "visit", "Visite d'une galerie"
    DONATION = "donation", "Don à un artiste"
    CLIP = "clip", "Clip sur l'accueil (24 h)"
    WALLET_TOPUP = "wallet_topup", "Recharge du Compte d'Avoir"


class Method(models.TextChoices):
    CARD = "card", "Carte bancaire"
    MOMO = "momo", "Mobile money"
    WALLET = "wallet", "Compte d'Avoir"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "En attente"
    SUCCEEDED = "succeeded", "Payé"
    FAILED = "failed", "Échoué"
    CANCELLED = "cancelled", "Annulé"


def new_reference() -> str:
    return uuid.uuid4().hex


class Payment(models.Model):
    reference = models.CharField("référence", max_length=32, unique=True, default=new_reference, editable=False)
    purpose = models.CharField("objet", max_length=20, choices=Purpose, db_index=True)
    method = models.CharField("moyen de paiement", max_length=10, choices=Method)
    status = models.CharField("statut", max_length=10, choices=PaymentStatus, default=PaymentStatus.PENDING, db_index=True)

    region = models.CharField("zone tarifaire", max_length=10, choices=Region)
    currency = models.CharField("devise", max_length=3)
    amount_ht = models.DecimalField("montant HT", max_digits=12, decimal_places=2)
    vat = models.DecimalField("TVA", max_digits=12, decimal_places=2, default=0)
    amount_ttc = models.DecimalField("montant TTC", max_digits=12, decimal_places=2)

    # Artiste concerné : celui qui paie (ouverture, publication…) ou qui reçoit (visite, don)
    artist = models.ForeignKey("accounts.ArtistProfile", on_delete=models.PROTECT, null=True, blank=True,
                               related_name="payments", verbose_name="artiste")
    # Compte qui paie, s'il est connecté (les visiteurs paient sans compte)
    payer_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="payments", verbose_name="payé par")
    payer_name = models.CharField("nom du payeur", max_length=150, blank=True)
    payer_email = models.EmailField("e-mail du payeur", blank=True)
    payer_phone = models.CharField("téléphone du payeur", max_length=20, blank=True)

    # Objet payé (œuvre, clip…), facultatif
    target_type = models.ForeignKey(ContentType, on_delete=models.PROTECT, null=True, blank=True)
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    target = GenericForeignKey("target_type", "target_id")

    metadata = models.JSONField("données", default=dict, blank=True)

    provider = models.CharField("prestataire", max_length=50, blank=True)
    provider_ref = models.CharField("référence prestataire", max_length=120, blank=True, db_index=True)
    failure_reason = models.CharField("motif d'échec", max_length=255, blank=True)

    created_at = models.DateTimeField("créé le", auto_now_add=True)
    paid_at = models.DateTimeField("payé le", null=True, blank=True)

    class Meta:
        verbose_name = "paiement"
        verbose_name_plural = "paiements"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["artist", "purpose", "status"]),
            models.Index(fields=["target_type", "target_id"]),
        ]

    def __str__(self):
        return f"{self.get_purpose_display()} — {self.amount_ttc} {self.currency} ({self.get_status_display()})"

    @property
    def is_paid(self) -> bool:
        return self.status == PaymentStatus.SUCCEEDED


# ---------------------------------------------------------------------------
# Répartition des revenus : grand livre
# ---------------------------------------------------------------------------
class LedgerAccount(models.TextChoices):
    ARTIST = "artist", "Artiste ou fondation"
    COPYRIGHT_OFFICE = "copyright_office", "Bureau de protection des œuvres"
    PROVISION = "provision", "Compte de provision (par artiste)"
    AGAPY = "agapy", "AGAPY-GALLERY"
    AGAPY_PROVISION = "agapy_provision", "AGAPY-GALLERY Provision"
    VAT = "vat", "TVA collectée"


class Direction(models.TextChoices):
    CREDIT = "credit", "Crédit"
    DEBIT = "debit", "Débit"


class LedgerEntry(models.Model):
    """
    Ligne du grand livre. Chaque paiement confirmé est réparti entre les comptes selon la clé
    du cahier des charges (apps.core.pricing). Un versement à l'artiste écrit un débit.
    """

    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, null=True, blank=True,
                                related_name="ledger_entries", verbose_name="paiement")
    payout = models.ForeignKey("PayoutRequest", on_delete=models.PROTECT, null=True, blank=True,
                               related_name="ledger_entries", verbose_name="versement")
    artist = models.ForeignKey("accounts.ArtistProfile", on_delete=models.PROTECT, null=True, blank=True,
                               related_name="ledger_entries", verbose_name="artiste")
    account = models.CharField("compte", max_length=20, choices=LedgerAccount, db_index=True)
    amount = models.DecimalField("montant", max_digits=12, decimal_places=2)
    currency = models.CharField("devise", max_length=3)
    direction = models.CharField("sens", max_length=6, choices=Direction, default=Direction.CREDIT)
    label = models.CharField("libellé", max_length=150, blank=True)
    created_at = models.DateTimeField("date", auto_now_add=True)

    class Meta:
        verbose_name = "écriture du grand livre"
        verbose_name_plural = "grand livre"
        ordering = ["-created_at", "-pk"]
        indexes = [models.Index(fields=["artist", "account", "currency"])]

    def __str__(self):
        sign = "+" if self.direction == Direction.CREDIT else "−"
        return f"{self.get_account_display()} {sign}{self.amount} {self.currency}"


# ---------------------------------------------------------------------------
# Versements aux artistes
# ---------------------------------------------------------------------------
class PayoutChannel(models.TextChoices):
    MOMO = "momo", "Mobile money"
    IBAN = "iban", "Virement bancaire"


class PayoutStatus(models.TextChoices):
    PENDING = "pending", "En attente"
    PAID = "paid", "Versé"
    REJECTED = "rejected", "Refusé"


class PayoutRequest(models.Model):
    artist = models.ForeignKey("accounts.ArtistProfile", on_delete=models.PROTECT, related_name="payout_requests",
                               verbose_name="artiste")
    amount = models.DecimalField("montant", max_digits=12, decimal_places=2)
    currency = models.CharField("devise", max_length=3)
    channel = models.CharField("canal", max_length=4, choices=PayoutChannel)
    # Coordonnées au moment de la demande (l'artiste peut les modifier ensuite)
    destination = models.CharField("coordonnées de versement", max_length=255)
    status = models.CharField("statut", max_length=10, choices=PayoutStatus, default=PayoutStatus.PENDING, db_index=True)
    note = models.CharField("remarque", max_length=255, blank=True)
    created_at = models.DateTimeField("demandé le", auto_now_add=True)
    processed_at = models.DateTimeField("traité le", null=True, blank=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="+", verbose_name="traité par")

    class Meta:
        verbose_name = "demande de versement"
        verbose_name_plural = "demandes de versement"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.artist} — {self.amount} {self.currency} ({self.get_status_display()})"


# ---------------------------------------------------------------------------
# Visites
# ---------------------------------------------------------------------------
class VisitPass(models.Model):
    """Droit de visite d'une galerie payante, remis au visiteur après paiement (jeton X-Visit-Token)."""

    token = models.CharField("jeton", max_length=64, unique=True)
    artist = models.ForeignKey("accounts.ArtistProfile", on_delete=models.CASCADE, related_name="visit_passes",
                               verbose_name="artiste")
    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, null=True, blank=True,
                                   related_name="visit_pass", verbose_name="paiement")
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    expires_at = models.DateTimeField("expire le")

    class Meta:
        verbose_name = "droit de visite"
        verbose_name_plural = "droits de visite"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Visite de {self.artist} (jusqu'au {self.expires_at:%d/%m/%Y %H:%M})"


class VisitLog(models.Model):
    """Une visite accordée (gratuite ou payante) : sert aux statistiques et au classement des artistes."""

    artist = models.ForeignKey("accounts.ArtistProfile", on_delete=models.CASCADE, related_name="visit_logs",
                               verbose_name="artiste")
    free = models.BooleanField("gratuite", default=False)
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
                                verbose_name="paiement")
    created_at = models.DateTimeField("date", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "visite"
        verbose_name_plural = "visites"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["artist", "created_at"])]

    def __str__(self):
        return f"{self.artist} — {'gratuite' if self.free else 'payante'} ({self.created_at:%d/%m/%Y})"
