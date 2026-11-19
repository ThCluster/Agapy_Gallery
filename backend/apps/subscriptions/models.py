"""
Abonnement annuel et Compte d'Avoir (cahier des charges p. 8 et 10).

- Subscription : droit de publication d'un artiste, valable un an à partir du paiement
  d'ouverture, puis prolongé d'un an à chaque renouvellement. À la date anniversaire,
  le compte est mis en veille (commande expire_subscriptions).
- Wallet : « Compte d'Avoir », provision d'argent facultative (activable/désactivable),
  utilisable comme moyen de paiement (publications, renouvellements…). Le solde n'est
  modifié que par des WalletEntry (une ligne par mouvement).
"""
from django.db import models
from django.utils import timezone


class Subscription(models.Model):
    artist = models.OneToOneField("accounts.ArtistProfile", on_delete=models.CASCADE, related_name="subscription",
                                  verbose_name="artiste")
    started_at = models.DateTimeField("ouvert le")
    expires_at = models.DateTimeField("expire le", db_index=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        verbose_name = "abonnement"
        verbose_name_plural = "abonnements"
        ordering = ["expires_at"]

    def __str__(self):
        return f"{self.artist} — jusqu'au {timezone.localtime(self.expires_at):%d/%m/%Y}"


class PeriodKind(models.TextChoices):
    SIGNUP = "signup", "Ouverture du compte"
    RENEWAL = "renewal", "Renouvellement"
    OFFLINE = "offline", "Prolongation (paiement reçu hors ligne)"
    BACKFILL = "backfill", "Reprise d'un compte existant"


class SubscriptionPeriod(models.Model):
    """Historique : une ligne par année payée."""

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="periods",
                                     verbose_name="abonnement")
    kind = models.CharField("origine", max_length=10, choices=PeriodKind)
    starts_at = models.DateTimeField("début")
    ends_at = models.DateTimeField("fin")
    payment = models.ForeignKey("payments.Payment", on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="subscription_periods", verbose_name="paiement")
    note = models.CharField("note", max_length=255, blank=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)

    class Meta:
        verbose_name = "période d'abonnement"
        verbose_name_plural = "périodes d'abonnement"
        ordering = ["-starts_at"]
        constraints = [
            models.UniqueConstraint(fields=["payment"], name="subscription_period_unique_payment"),
        ]


class ReminderKind(models.TextChoices):
    J30 = "j30", "Rappel à 30 jours"
    J7 = "j7", "Rappel à 7 jours"
    EXPIRED = "expired", "Mise en veille"


class SubscriptionReminder(models.Model):
    """Trace des rappels envoyés, pour ne jamais envoyer deux fois le même pour une même échéance."""

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="reminders",
                                     verbose_name="abonnement")
    kind = models.CharField("type", max_length=10, choices=ReminderKind)
    expires_at = models.DateTimeField("échéance concernée")
    sent_at = models.DateTimeField("envoyé le", auto_now_add=True)

    class Meta:
        verbose_name = "rappel d'abonnement"
        verbose_name_plural = "rappels d'abonnement"
        ordering = ["-sent_at"]
        constraints = [
            models.UniqueConstraint(fields=["subscription", "kind", "expires_at"], name="subscription_reminder_once"),
        ]


class Wallet(models.Model):
    artist = models.OneToOneField("accounts.ArtistProfile", on_delete=models.CASCADE, related_name="wallet",
                                  verbose_name="artiste")
    is_active = models.BooleanField("activé", default=False,
                                    help_text="Facultatif : l'artiste l'active ou le désactive à tout moment.")
    balance = models.DecimalField("solde", max_digits=12, decimal_places=2, default=0)
    currency = models.CharField("devise", max_length=3)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        verbose_name = "Compte d'Avoir"
        verbose_name_plural = "Comptes d'Avoir"

    def __str__(self):
        return f"{self.artist} — {self.balance} {self.currency}"


class WalletEntry(models.Model):
    """Mouvement du Compte d'Avoir : positif pour une recharge, négatif pour une dépense."""

    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="entries", verbose_name="compte")
    amount = models.DecimalField("montant", max_digits=12, decimal_places=2)
    balance_after = models.DecimalField("solde après", max_digits=12, decimal_places=2)
    label = models.CharField("libellé", max_length=200)
    payment = models.ForeignKey("payments.Payment", on_delete=models.PROTECT, null=True, blank=True,
                                related_name="wallet_entries", verbose_name="paiement")
    created_at = models.DateTimeField("date", auto_now_add=True)

    class Meta:
        verbose_name = "mouvement du Compte d'Avoir"
        verbose_name_plural = "mouvements du Compte d'Avoir"
        ordering = ["-created_at", "-id"]
        constraints = [
            # Un paiement ne crédite ou ne débite qu'une seule fois
            models.UniqueConstraint(fields=["payment"], name="wallet_entry_unique_payment"),
        ]

    def __str__(self):
        return f"{self.amount} {self.wallet.currency} — {self.label}"
