"""
Point d'entrée unique pour prévenir un artiste par SMS et par e-mail.

Les envois sont synchrones pour l'instant. Quand le volume augmentera, ils passeront
dans une file de tâches (Celery ou équivalent) sans changer les appels.
"""
import logging

from django.core.mail import send_mail

from .sms import get_backend, mask_phone

logger = logging.getLogger("agapy.notifications")


def send_sms(to: str, message: str) -> bool:
    try:
        get_backend().send(to, message)
        return True
    except Exception:
        logger.exception("Échec de l'envoi du SMS à %s", mask_phone(to))
        return False


def send_email(to: str, subject: str, body: str) -> bool:
    if not to:
        return False
    try:
        send_mail(subject, body, None, [to])
        return True
    except Exception:
        logger.exception("Échec de l'envoi de l'e-mail à %s", to)
        return False
