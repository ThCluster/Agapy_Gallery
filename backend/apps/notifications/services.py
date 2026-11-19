"""
Point d'entrée unique pour prévenir un artiste par SMS et par e-mail.

- Mode synchrone (défaut, NOTIFICATIONS_ASYNC=False) : le message part pendant la requête.
- Mode différé (NOTIFICATIONS_ASYNC=True) : le message est enregistré (chiffré) dans OutboundMessage
  et la commande `send_pending_notifications`, lancée chaque minute par cron, l'envoie
  (3 essais avec un délai progressif). send_sms / send_email renvoient alors True si le message
  a bien été mis en file.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import Channel, OutboundMessage, OutboundStatus
from .sms import get_backend, mask_phone

logger = logging.getLogger("agapy.notifications")

# Délai avant le 2e puis le 3e essai
RETRY_DELAYS = (timedelta(minutes=1), timedelta(minutes=5))


def mask_email(email: str) -> str:
    """« jean.dupont@exemple.com » → « j…@exemple.com »."""
    local, _, domain = (email or "").partition("@")
    return f"{local[:1]}…@{domain}" if domain else "…"


def _async() -> bool:
    return bool(getattr(settings, "NOTIFICATIONS_ASYNC", False))


# ---------------------------------------------------------------------------
# Envoi immédiat (lève une exception en cas d'échec)
# ---------------------------------------------------------------------------
def deliver_sms(to: str, message: str) -> None:
    get_backend().send(to, message)


def deliver_email(to: str, subject: str, body: str) -> None:
    send_mail(subject, body, None, [to])


def _enqueue(channel: str, hint: str, content: dict) -> bool:
    """Met le message en file. En cas d'impossibilité (clé de chiffrement absente…), renvoie False."""
    try:
        msg = OutboundMessage(channel=channel, recipient_hint=hint[:40])
        msg.set_content(content)
        msg.save()
        return True
    except Exception:
        logger.exception("Impossible de mettre en file le message (%s) pour %s : envoi immédiat", channel, hint)
        return False


# ---------------------------------------------------------------------------
# API publique
# ---------------------------------------------------------------------------
def send_sms(to: str, message: str) -> bool:
    if _async() and _enqueue(Channel.SMS, mask_phone(to), {"to": to, "message": message}):
        return True
    try:
        deliver_sms(to, message)
        return True
    except Exception:
        logger.exception("Échec de l'envoi du SMS à %s", mask_phone(to))
        return False


def send_email(to: str, subject: str, body: str) -> bool:
    if not to:
        return False
    if _async() and _enqueue(Channel.EMAIL, mask_email(to), {"to": to, "subject": subject, "body": body}):
        return True
    try:
        deliver_email(to, subject, body)
        return True
    except Exception:
        logger.exception("Échec de l'envoi de l'e-mail à %s", mask_email(to))
        return False


# ---------------------------------------------------------------------------
# File d'attente (commande send_pending_notifications)
# ---------------------------------------------------------------------------
def _deliver(msg: OutboundMessage) -> None:
    content = msg.get_content()
    if msg.channel == Channel.SMS:
        deliver_sms(content["to"], content["message"])
    else:
        deliver_email(content["to"], content["subject"], content["body"])


def process_message(msg: OutboundMessage) -> bool:
    """Un essai d'envoi ; met à jour le statut. Le contenu est effacé une fois envoyé ou abandonné."""
    msg.attempts += 1
    try:
        _deliver(msg)
    except Exception as exc:
        # Pas de str(exc) : certaines bibliothèques recopient la requête (donc le contenu) dans l'erreur
        msg.last_error = type(exc).__name__[:255]
        unreadable = isinstance(exc, ValueError) and "chiffré" in str(exc)
        if msg.attempts >= OutboundMessage.MAX_ATTEMPTS or unreadable:
            msg.status = OutboundStatus.FAILED
            msg.payload = ""
            logger.error("Notification %s (%s à %s) abandonnée après %d essai(s) : %s", msg.pk, msg.channel,
                         msg.recipient_hint, msg.attempts, msg.last_error)
        else:
            msg.next_attempt_at = timezone.now() + RETRY_DELAYS[min(msg.attempts, len(RETRY_DELAYS)) - 1]
            logger.warning("Notification %s (%s à %s) : essai %d échoué (%s)", msg.pk, msg.channel,
                           msg.recipient_hint, msg.attempts, msg.last_error)
        msg.save(update_fields=["attempts", "status", "payload", "next_attempt_at", "last_error"])
        return False
    msg.status = OutboundStatus.SENT
    msg.sent_at = timezone.now()
    msg.payload = ""
    msg.last_error = ""
    msg.save(update_fields=["attempts", "status", "payload", "sent_at", "last_error"])
    return True


def send_pending(limit: int = 200) -> dict:
    """Envoie les messages dont l'heure est venue. Sûr si deux commandes tournent en même temps (MySQL)."""
    stats = {"sent": 0, "retry": 0, "failed": 0}
    with transaction.atomic():
        batch = list(
            OutboundMessage.objects.select_for_update(skip_locked=True)
            .filter(status=OutboundStatus.PENDING, next_attempt_at__lte=timezone.now())
            .order_by("next_attempt_at", "id")[:limit]
        )
        for msg in batch:
            if process_message(msg):
                stats["sent"] += 1
            elif msg.status == OutboundStatus.FAILED:
                stats["failed"] += 1
            else:
                stats["retry"] += 1
    return stats


def purge_old(days: int = 30) -> int:
    """Supprime les traces des messages envoyés ou abandonnés depuis plus de `days` jours."""
    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = OutboundMessage.objects.filter(
        status__in=[OutboundStatus.SENT, OutboundStatus.FAILED], created_at__lt=cutoff).delete()
    return deleted
