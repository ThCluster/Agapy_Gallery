"""
Règles métier des comptes visiteurs : code SMS d'inscription, création du compte, droits de visite.

Les codes reprennent les règles du mot de passe oublié (apps.accounts.services) : 6 chiffres,
empreinte HMAC, durée PASSWORD_RESET_CODE_LIFETIME (10 min), PASSWORD_RESET_CODE_MAX_ATTEMPTS
essais par code, délai entre deux envois, plafonds par numéro (heure / jour) et plafond d'échecs
de vérification par numéro et par jour, tous codes confondus.
"""
import hashlib
import hmac
import logging
import secrets

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.services import incr_counter
from apps.notifications.services import send_sms
from apps.notifications.sms import mask_phone

from .models import SignupCode, VisitorProfile

logger = logging.getLogger("agapy.visitors")


class VisitorError(Exception):
    def __init__(self, code: str, message: str, field: str = "detail"):
        super().__init__(message)
        self.code = code
        self.message = message
        self.field = field


PHONE_TAKEN = ("phone_taken", "Ce numéro est déjà associé à un compte AGAPY-GALLERY.")


def phone_taken(phone: str) -> bool:
    return User.objects.filter(phone=phone).exists()


def _hash(phone: str, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"visitor-signup:{phone}:{code}".encode(),
                    hashlib.sha256).hexdigest()


def request_signup_code(phone: str) -> None:
    """
    Envoie un code par SMS au numéro à inscrire. Lève VisitorError("phone_taken") si le numéro a déjà
    un compte. Délai entre deux envois et plafonds atteints : rien n'est envoyé, la réponse ne change pas.
    """
    if phone_taken(phone):
        raise VisitorError(*PHONE_TAKEN, field="phone")
    now = timezone.now()
    last = SignupCode.objects.filter(phone=phone).first()
    if last and now - last.created_at < settings.PASSWORD_RESET_CODE_COOLDOWN:
        return
    hour_key, day_key = f"visitor-code-h:{phone}", f"visitor-code-d:{phone}"
    if (cache.get(hour_key, 0) >= settings.PASSWORD_RESET_CODES_PER_HOUR
            or cache.get(day_key, 0) >= settings.PASSWORD_RESET_CODES_PER_DAY):
        logger.warning("Plafond de codes d'inscription atteint pour %s", mask_phone(phone))
        return
    incr_counter(hour_key, 3600)
    incr_counter(day_key, 24 * 3600)

    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        SignupCode.objects.filter(phone=phone, used_at__isnull=True).update(used_at=now)  # un seul code valide
        SignupCode.objects.create(phone=phone, code_hash=_hash(phone, code),
                                  expires_at=now + settings.PASSWORD_RESET_CODE_LIFETIME)
    minutes = int(settings.PASSWORD_RESET_CODE_LIFETIME.total_seconds() // 60)
    send_sms(phone, f"AGAPY-GALLERY : votre code d'inscription est {code}. Il est valable {minutes} minutes.")


def consume_signup_code(phone: str, code: str) -> SignupCode:
    """
    Vérifie le code et le marque utilisé (usage unique, même en cas d'appels simultanés).
    Ne pas appeler dans une transaction annulée en cas d'échec : l'essai raté doit rester compté.
    """
    invalid = VisitorError("code_invalid", "Code incorrect ou expiré.", field="code")
    failures_key = f"visitor-code-failures:{phone}"
    day = 24 * 3600
    if cache.get(failures_key, 0) >= settings.PASSWORD_RESET_VERIFY_MAX_FAILURES_PER_DAY:
        raise invalid
    with transaction.atomic():
        entry = (SignupCode.objects.select_for_update()
                 .filter(phone=phone, used_at__isnull=True, expires_at__gt=timezone.now()).first())
        ok = (entry is not None and entry.attempts < settings.PASSWORD_RESET_CODE_MAX_ATTEMPTS
              and hmac.compare_digest(entry.code_hash, _hash(phone, code)))
        if ok:
            entry.used_at = timezone.now()
            entry.save(update_fields=["used_at"])
        elif entry is not None:
            SignupCode.objects.filter(pk=entry.pk).update(attempts=F("attempts") + 1)
    if not ok:
        incr_counter(failures_key, day)
        raise invalid
    return entry


def create_visitor(*, phone: str, code: str, password: str, display_name: str, country: str,
                   email: str = "") -> User:
    """Crée le compte visiteur (actif) et son Compte d'Avoir (désactivé). Le code SMS est exigé."""
    from apps.subscriptions.services import ensure_visitor_wallet

    if phone_taken(phone):
        raise VisitorError(*PHONE_TAKEN, field="phone")
    # Vérification du code hors de la transaction de création : un essai raté reste compté
    consume_signup_code(phone, code)
    try:
        with transaction.atomic():
            user = User.objects.create_user(phone=phone, password=password, email=email or "", is_active=True)
            VisitorProfile.objects.create(user=user, display_name=display_name.strip(), country=country.upper())
            ensure_visitor_wallet(user)
    except IntegrityError:  # inscription simultanée du même numéro
        raise VisitorError(*PHONE_TAKEN, field="phone")
    logger.info("Compte visiteur créé : %s", mask_phone(phone))
    return user


def valid_visit_passes(user):
    """Droits de visite encore valables achetés par ce compte, le plus récent par artiste."""
    from apps.payments.models import VisitPass

    passes = (VisitPass.objects.select_related("artist")
              .filter(payment__payer_user=user, expires_at__gt=timezone.now())
              .order_by("artist_id", "-expires_at"))
    seen, result = set(), []
    for p in passes:
        if p.artist_id not in seen:
            seen.add(p.artist_id)
            result.append(p)
    return sorted(result, key=lambda p: p.expires_at, reverse=True)
