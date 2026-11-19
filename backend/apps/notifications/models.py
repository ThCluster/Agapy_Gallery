from django.db import models
from django.utils import timezone

from . import crypto


class Channel(models.TextChoices):
    SMS = "sms", "SMS"
    EMAIL = "email", "E-mail"


class OutboundStatus(models.TextChoices):
    PENDING = "pending", "En attente"
    SENT = "sent", "Envoyé"
    FAILED = "failed", "Échec définitif"


class OutboundMessage(models.Model):
    """
    SMS ou e-mail en attente d'envoi (NOTIFICATIONS_ASYNC=True), envoyé par la commande
    send_pending_notifications. Le destinataire et le contenu (identifiants, codes) sont chiffrés
    dans `payload` et effacés dès que le message est envoyé ou abandonné.
    """

    MAX_ATTEMPTS = 3

    channel = models.CharField("canal", max_length=10, choices=Channel.choices)
    recipient_hint = models.CharField("destinataire (masqué)", max_length=40, blank=True)
    payload = models.TextField("contenu chiffré", blank=True)
    status = models.CharField("statut", max_length=10, choices=OutboundStatus.choices,
                              default=OutboundStatus.PENDING)
    attempts = models.PositiveSmallIntegerField("essais", default=0)
    next_attempt_at = models.DateTimeField("prochaine tentative", default=timezone.now)
    last_error = models.CharField("dernière erreur", max_length=255, blank=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    sent_at = models.DateTimeField("envoyé le", null=True, blank=True)

    class Meta:
        verbose_name = "notification sortante"
        verbose_name_plural = "notifications sortantes"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "next_attempt_at"])]

    def __str__(self):
        return f"{self.get_channel_display()} → {self.recipient_hint} ({self.get_status_display()})"

    def set_content(self, data: dict) -> None:
        self.payload = crypto.encrypt_json(data)

    def get_content(self) -> dict:
        return crypto.decrypt_json(self.payload)
