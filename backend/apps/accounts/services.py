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
from django.db.models import F, Q
from django.utils import timezone

from apps.notifications.services import send_email, send_sms
from apps.notifications.sms import mask_phone

from .models import ArtistProfile, ArtistStatus, PasswordResetCode, User

# Liste rouge d'au moins 3 mois après une œuvre inappropriée (cahier des charges p. 13)
RED_LIST_DAYS = 90
from . import fingerprints
from .tokens import revoke_all_tokens
from .validators import PASSWORD_RULE

logger = logging.getLogger("agapy.accounts")


# ---------------------------------------------------------------------------
# Compteurs dans le cache (fenêtre fixe qui commence au premier événement)
# ---------------------------------------------------------------------------
def incr_counter(key: str, timeout: int | None) -> int:
    if cache.add(key, 1, timeout=timeout):
        return 1
    try:
        return cache.incr(key)
    except ValueError:  # la clé a expiré entre-temps
        cache.set(key, 1, timeout=timeout)
        return 1


# ---------------------------------------------------------------------------
# Blocage après trop d'échecs de connexion :
# - par couple (numéro, adresse IP) : LOGIN_MAX_FAILURES échecs bloquent ce couple ;
# - par numéro, toutes adresses confondues : seuil plus élevé (LOGIN_GLOBAL_MAX_FAILURES).
# Un attaquant ne peut plus bloquer le vrai titulaire depuis une autre adresse, sauf à
# dépasser le seuil global.
# ---------------------------------------------------------------------------
def _login_generation(phone: str) -> int:
    # Incrémentée par reset_all_login_failures() : invalide d'un coup tous les compteurs par IP
    return cache.get(f"login-gen:{phone}", 0)


def _pair_key(phone: str, ip: str) -> str:
    return f"login-failures:{phone}:{_login_generation(phone)}:{ip or '-'}"


def _global_key(phone: str) -> str:
    return f"login-failures-all:{phone}"


def is_login_locked(phone: str, ip: str = "") -> bool:
    return (
        cache.get(_pair_key(phone, ip), 0) >= settings.LOGIN_MAX_FAILURES
        or cache.get(_global_key(phone), 0) >= settings.LOGIN_GLOBAL_MAX_FAILURES
    )


def record_login_failure(phone: str, ip: str = "") -> None:
    timeout = int(settings.LOGIN_LOCKOUT.total_seconds())
    incr_counter(_pair_key(phone, ip), timeout)
    incr_counter(_global_key(phone), timeout)


def reset_login_failures(phone: str, ip: str = "") -> None:
    """Connexion réussie depuis `ip`."""
    cache.delete_many([_pair_key(phone, ip), _global_key(phone)])


def reset_all_login_failures(phone: str) -> None:
    """Mot de passe réinitialisé : plus aucun blocage pour ce numéro, quelle que soit l'adresse."""
    incr_counter(f"login-gen:{phone}", timeout=None)
    cache.delete(_global_key(phone))


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
    identifiants par SMS (cahier des charges p. 7) ; l'e-mail prévient sans le mot de passe.
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
    # Le mot de passe part UNIQUEMENT par SMS : le numéro de téléphone est l'identité du compte.
    # L'e-mail d'une inscription en attente peut être remplacé par quiconque connaît le numéro
    # (inscription recommencée) : il ne reçoit donc jamais le mot de passe.
    email_body = (
        f"Bienvenue sur AGAPY-GALLERY, {profile.display_name} !\n\n"
        "Votre compte artiste est activé. Vos identifiants de connexion ont été envoyés par SMS "
        f"au {mask_phone(user.phone)}.\n"
        f"Connexion : {login_url}\n\n"
        "Pensez à changer votre mot de passe depuis votre espace artiste."
    )
    transaction.on_commit(lambda: send_sms(user.phone, message))
    transaction.on_commit(lambda: send_email(user.email, "Votre compte AGAPY-GALLERY est activé", email_body))
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
    # Plafonds par numéro (coût des SMS, harcèlement du titulaire) ; la réponse de l'API ne change pas
    hour_key, day_key = f"reset-sent-h:{phone}", f"reset-sent-d:{phone}"
    if (cache.get(hour_key, 0) >= settings.PASSWORD_RESET_CODES_PER_HOUR
            or cache.get(day_key, 0) >= settings.PASSWORD_RESET_CODES_PER_DAY):
        logger.warning("Plafond de codes de réinitialisation atteint pour %s", mask_phone(phone))
        return
    incr_counter(hour_key, 3600)
    incr_counter(day_key, 24 * 3600)

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
    # Échecs cumulés par numéro et par jour, tous codes confondus : sans cela, redemander un code
    # remettrait le nombre d'essais à zéro et permettrait de deviner un code à la longue.
    failures_key = f"reset-verify-failures:{phone}"
    day = 24 * 3600
    if cache.get(failures_key, 0) >= settings.PASSWORD_RESET_VERIFY_MAX_FAILURES_PER_DAY:
        raise invalid
    user = User.objects.filter(phone=phone, is_active=True).first()
    if user is None:
        incr_counter(failures_key, day)
        raise invalid
    entry = (
        user.reset_codes.filter(used_at__isnull=True, verified_at__isnull=True, expires_at__gt=timezone.now())
        .first()
    )
    if entry is None or entry.attempts >= settings.PASSWORD_RESET_CODE_MAX_ATTEMPTS:
        incr_counter(failures_key, day)
        raise invalid
    if not hmac.compare_digest(entry.code_hash, _hash_code(user.pk, code)):
        PasswordResetCode.objects.filter(pk=entry.pk).update(attempts=F("attempts") + 1)
        incr_counter(failures_key, day)
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
    reset_all_login_failures(user.phone)


@transaction.atomic
def change_password(user: User, password: str) -> None:
    user.set_password(password)
    user.save(update_fields=["password"])
    revoke_all_tokens(user)


def notify_payout_changed(user: User) -> None:
    """Alerte par SMS au titulaire du numéro : un détournement des gains ne passe pas inaperçu."""
    transaction.on_commit(lambda: send_sms(
        user.phone,
        "AGAPY-GALLERY : vos coordonnées de versement ont été modifiées. Si vous n'êtes pas à "
        "l'origine de ce changement, changez votre mot de passe et contactez-nous.",
    ))


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


# ---------------------------------------------------------------------------
# Contournement des sanctions : un artiste exclu ou sur liste rouge qui se réinscrit avec un
# autre numéro (cahier des charges p. 13) est reconnu à ses coordonnées (e-mail, IBAN, mobile
# money, numéro), comparées par empreintes car l'IBAN et le numéro momo sont chiffrés en base.
# ---------------------------------------------------------------------------
BANNED_MESSAGE = "L'inscription n'a pas pu aboutir. Contactez l'équipe AGAPY-GALLERY."


def sanction_matches(*, email="", iban="", momo_number="", phone="", exclude_pk=None) -> dict:
    """
    Comptes sanctionnés qui partagent une coordonnée avec celles données.
    Renvoie {"excluded": [(profil, [coordonnées])], "red_listed": [...]}.
    """
    email_fp = fingerprints.email_fingerprint(email)
    iban_fp = fingerprints.iban_fingerprint(iban)
    numbers = {fp for fp in (fingerprints.number_fingerprint(momo_number), fingerprints.number_fingerprint(phone)) if fp}
    q = Q()
    if email_fp:
        q |= Q(email_fingerprint=email_fp)
    if iban_fp:
        q |= Q(iban_fingerprint=iban_fp)
    if numbers:
        q |= Q(momo_fingerprint__in=numbers) | Q(phone_fingerprint__in=numbers)
    result = {"excluded": [], "red_listed": []}
    if not q:
        return result
    sanctioned = Q(status=ArtistStatus.EXCLUDED) | Q(red_listed_until__gte=timezone.localdate())
    qs = ArtistProfile.objects.filter(q).filter(sanctioned)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    for other in qs.only("pk", "slug", "status", "red_listed_until", *ArtistProfile.FINGERPRINT_FIELDS):
        shared = []
        if email_fp and other.email_fingerprint == email_fp:
            shared.append("e-mail")
        if iban_fp and other.iban_fingerprint == iban_fp:
            shared.append("IBAN")
        if numbers & {other.momo_fingerprint, other.phone_fingerprint}:
            shared.append("numéro")
        key = "excluded" if other.status == ArtistStatus.EXCLUDED else "red_listed"
        result[key].append((other, shared))
    return result


def describe_matches(matches: list) -> str:
    parts = [f"{other.slug} ({', '.join(shared)})" for other, shared in matches]
    return "; ".join(parts)


def flag_reason_for(matches: dict) -> str:
    """Texte du signalement « à vérifier » (vide s'il n'y a rien à signaler)."""
    reasons = []
    if matches["excluded"]:
        reasons.append("Coordonnées communes avec un compte exclu : " + describe_matches(matches["excluded"]))
    if matches["red_listed"]:
        reasons.append("Coordonnées communes avec un compte sur liste rouge : " + describe_matches(matches["red_listed"]))
    return " | ".join(reasons)[:255]


def flag_if_sanction_evasion(profile: ArtistProfile) -> str:
    """
    À appeler après un changement de coordonnées (versements, e-mail) d'un compte existant :
    on signale à l'équipe sans bloquer (l'équipe décide). Renvoie le motif ajouté, ou "".
    """
    matches = sanction_matches(email=profile.user.email, iban=profile.iban, momo_number=profile.momo_number,
                               phone=profile.user.phone, exclude_pk=profile.pk)
    reason = flag_reason_for(matches)
    if reason and reason not in profile.flagged_reason:
        profile.flagged_reason = reason
        profile.save(update_fields=["flagged_reason", "updated_at"])
        logger.warning("Compte %s signalé : %s", profile.slug, reason)
        return reason
    return ""
