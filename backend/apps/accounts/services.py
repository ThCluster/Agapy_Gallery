"""Règles métier des comptes, appelées par les vues, l'administration et les autres modules."""
import hashlib
import hmac
import logging
import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.notifications.services import send_email, send_sms

from .models import ArtistProfile, ArtistStatus, PasswordResetCode, User

# Liste rouge d'au moins 3 mois après une œuvre inappropriée (cahier des charges p. 13)
RED_LIST_DAYS = 90
from .tokens import revoke_all_tokens
from .validators import PASSWORD_RULE

logger = logging.getLogger("agapy.accounts")


# ---------------------------------------------------------------------------
# Blocage après trop d'échecs de connexion (par numéro, en plus de la limite par adresse IP)
# ---------------------------------------------------------------------------
def _failures_key(phone: str) -> str:
    return f"login-failures:{phone}"


def is_login_locked(phone: str) -> bool:
    return cache.get(_failures_key(phone), 0) >= settings.LOGIN_MAX_FAILURES


def record_login_failure(phone: str) -> None:
    key = _failures_key(phone)
    if not cache.add(key, 1, timeout=int(settings.LOGIN_LOCKOUT.total_seconds())):
        try:
            cache.incr(key)
        except ValueError:  # la clé a expiré entre-temps
            cache.set(key, 1, timeout=int(settings.LOGIN_LOCKOUT.total_seconds()))


def reset_login_failures(phone: str) -> None:
    cache.delete(_failures_key(phone))


# ---------------------------------------------------------------------------
# Activation du compte après paiement des frais d'ouverture
# ---------------------------------------------------------------------------
def generate_password(length: int = 10) -> str:
    """
    Mot de passe aléatoire conforme à la règle. Cahier des charges p. 15 : lettres « de préférence
    en majuscule » et chiffres. Sans caractères ambigus (0/O, 1/I) pour être recopié depuis un SMS.
    """
    alphabet = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1I")
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if PASSWORD_RULE.match(pwd):
            return pwd


@transaction.atomic
def activate_account(profile: ArtistProfile) -> None:
    """
    À appeler quand le paiement des frais d'ouverture est confirmé (module paiements,
    ou action manuelle dans l'administration). Crée le mot de passe et envoie les
    identifiants par SMS et par e-mail (cahier des charges p. 7).
    """
    profile = ArtistProfile.objects.select_for_update().select_related("user").get(pk=profile.pk)
    if profile.status != ArtistStatus.PENDING_PAYMENT:
        return
    user = profile.user
    password = generate_password()
    user.set_password(password)
    user.is_active = True
    user.save(update_fields=["password", "is_active"])
    profile.status = ArtistStatus.ACTIVE
    profile.activated_at = timezone.now()
    profile.save(update_fields=["status", "activated_at", "updated_at"])

    login_url = f"{settings.FRONTEND_URL}/connexion"
    message = (
        f"Bienvenue sur AGAPY-GALLERY, {profile.display_name} !\n"
        f"Identifiant : {user.phone_display}\nMot de passe : {password}\n"
        f"Connexion : {login_url}"
    )
    transaction.on_commit(lambda: send_sms(user.phone, message))
    transaction.on_commit(lambda: send_email(
        user.email,
        "Vos identifiants AGAPY-GALLERY",
        f"{message}\n\nPensez à changer votre mot de passe depuis votre espace artiste.",
    ))
    logger.info("Compte artiste activé : %s", profile.slug)


# ---------------------------------------------------------------------------
# Mot de passe oublié : code SMS → jeton de réinitialisation → nouveau mot de passe
# ---------------------------------------------------------------------------
RESET_TOKEN_SALT = "agapy.accounts.password-reset"


class ResetError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _hash_code(user_id: int, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def request_reset_code(phone: str) -> None:
    """
    Envoie un code par SMS si le numéro correspond à un compte actif.
    Ne dit jamais si le compte existe, pour ne pas révéler les numéros inscrits.
    """
    user = User.objects.filter(phone=phone, is_active=True).first()
    if user is None:
        return
    now = timezone.now()
    last = user.reset_codes.first()
    if last and now - last.created_at < settings.PASSWORD_RESET_CODE_COOLDOWN:
        return  # un code vient déjà d'être envoyé

    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        # Un seul code valide à la fois
        user.reset_codes.filter(used_at__isnull=True).update(used_at=now)
        PasswordResetCode.objects.create(
            user=user,
            code_hash=_hash_code(user.pk, code),
            expires_at=now + settings.PASSWORD_RESET_CODE_LIFETIME,
        )
    minutes = int(settings.PASSWORD_RESET_CODE_LIFETIME.total_seconds() // 60)
    send_sms(user.phone, f"AGAPY-GALLERY : votre code de réinitialisation est {code}. Il est valable {minutes} minutes.")


def verify_reset_code(phone: str, code: str) -> str:
    """Vérifie le code et renvoie un jeton de réinitialisation à usage unique."""
    invalid = ResetError("code_invalid", "Code incorrect ou expiré.")
    user = User.objects.filter(phone=phone, is_active=True).first()
    if user is None:
        raise invalid
    entry = (
        user.reset_codes.filter(used_at__isnull=True, verified_at__isnull=True, expires_at__gt=timezone.now())
        .first()
    )
    if entry is None or entry.attempts >= settings.PASSWORD_RESET_CODE_MAX_ATTEMPTS:
        raise invalid
    if not hmac.compare_digest(entry.code_hash, _hash_code(user.pk, code)):
        PasswordResetCode.objects.filter(pk=entry.pk).update(attempts=F("attempts") + 1)
        raise invalid

    entry.verified_at = timezone.now()
    entry.save(update_fields=["verified_at"])
    return signing.dumps({"u": user.pk, "c": entry.pk, "v": user.auth_version}, salt=RESET_TOKEN_SALT)


def load_reset_token(token: str) -> tuple[User, PasswordResetCode]:
    expired = ResetError("reset_token_invalid", "Le lien de réinitialisation a expiré, recommencez.")
    try:
        data = signing.loads(token, salt=RESET_TOKEN_SALT, max_age=settings.PASSWORD_RESET_TOKEN_LIFETIME)
    except signing.BadSignature:
        raise expired
    entry = (
        PasswordResetCode.objects.select_related("user")
        .filter(pk=data.get("c"), user_id=data.get("u"), verified_at__isnull=False, used_at__isnull=True)
        .first()
    )
    if entry is None or not entry.user.is_active or entry.user.auth_version != data.get("v"):
        raise expired
    return entry.user, entry


@transaction.atomic
def reset_password(user: User, entry: PasswordResetCode, password: str) -> None:
    user.set_password(password)
    user.save(update_fields=["password"])
    entry.used_at = timezone.now()
    entry.save(update_fields=["used_at"])
    revoke_all_tokens(user)
    reset_login_failures(user.phone)


@transaction.atomic
def change_password(user: User, password: str) -> None:
    user.set_password(password)
    user.save(update_fields=["password"])
    revoke_all_tokens(user)


# ---------------------------------------------------------------------------
# Sanctions (administration et modération des œuvres)
# ---------------------------------------------------------------------------
def red_list_artist(artist: ArtistProfile, days: int = RED_LIST_DAYS):
    """Liste rouge : plus de publication pendant `days` jours. Ne raccourcit jamais une liste rouge en cours."""
    until = timezone.localdate() + timedelta(days=days)
    if not artist.red_listed_until or artist.red_listed_until < until:
        artist.red_listed_until = until
        artist.save(update_fields=["red_listed_until", "updated_at"])
    return artist.red_listed_until


@transaction.atomic
def exclude_artist(artist: ArtistProfile) -> None:
    """Exclusion définitive (œuvre volée) : compte désactivé et sessions fermées."""
    artist.status = ArtistStatus.EXCLUDED
    artist.save(update_fields=["status", "updated_at"])
    artist.user.is_active = False
    artist.user.save(update_fields=["is_active"])
    revoke_all_tokens(artist.user)
