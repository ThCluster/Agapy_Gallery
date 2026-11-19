"""
Logique de l'abonnement annuel et du Compte d'Avoir.

Les vues, l'administration, les fonctions @on_paid et la commande expire_subscriptions
passent toutes par ici.
"""
import logging
import math
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import ArtistProfile, ArtistStatus
from apps.core.pricing import CURRENCY_OF_REGION, Currency, donation_quote, quote, round_money
from apps.notifications.services import send_email, send_sms
from apps.payments import services as payments
from apps.payments.providers import ProviderError

from .models import (
    PeriodKind,
    ReminderKind,
    Subscription,
    SubscriptionPeriod,
    SubscriptionReminder,
    Wallet,
    WalletEntry,
)

logger = logging.getLogger("agapy.subscriptions")

SOON_DAYS = 30
REMINDER_DAYS = {ReminderKind.J30: 30, ReminderKind.J7: 7}

# Recharge du Compte d'Avoir : bornes par devise
TOPUP_LIMITS = {
    Currency.XOF: (Decimal("1000"), Decimal("5000000")),
    Currency.EUR: (Decimal("2"), Decimal("10000")),
    Currency.USD: (Decimal("2"), Decimal("10000")),
}
TOPUP_METHODS = ("card", "momo")


class SubscriptionError(Exception):
    """Erreur métier avec un code stable (renvoyée en 400 par les vues)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# --- Dates -------------------------------------------------------------------

def add_year(dt: datetime) -> datetime:
    """Même jour l'année suivante (le 29 février devient le 28)."""
    try:
        return dt.replace(year=dt.year + 1)
    except ValueError:
        return dt.replace(year=dt.year + 1, day=28)


def days_left(sub: Subscription, now=None) -> int:
    now = now or timezone.now()
    return max(0, math.ceil((sub.expires_at - now) / timedelta(days=1)))


def state_of(sub: Subscription, now=None) -> str:
    """active | soon (≤ 30 jours) | standby (échu ou compte en veille). Miroir de subscriptionState() du frontend."""
    now = now or timezone.now()
    if sub.expires_at <= now or sub.artist.status == ArtistStatus.DORMANT:
        return "standby"
    return "soon" if sub.expires_at - now <= timedelta(days=SOON_DAYS) else "active"


# --- Abonnement --------------------------------------------------------------

def get_subscription(artist: ArtistProfile) -> Subscription | None:
    """
    Abonnement de l'artiste. Les comptes activés avant ce module n'en ont pas : il est créé
    à la volée à partir de la date d'activation.
    """
    try:
        return artist.subscription
    except Subscription.DoesNotExist:
        pass
    if artist.status not in (ArtistStatus.ACTIVE, ArtistStatus.DORMANT):
        return None
    base = artist.activated_at or artist.created_at or timezone.now()
    with transaction.atomic():
        sub, created = Subscription.objects.get_or_create(
            artist=artist, defaults={"started_at": base, "expires_at": add_year(base)})
        if created:
            SubscriptionPeriod.objects.create(subscription=sub, kind=PeriodKind.BACKFILL, starts_at=base,
                                              ends_at=sub.expires_at)
    artist.subscription = sub
    return sub


@transaction.atomic
def start_subscription(artist: ArtistProfile, payment=None, at=None) -> Subscription:
    """Ouverture : un an à partir du paiement. Crée aussi le Compte d'Avoir (inactif). Idempotent."""
    ensure_wallet(artist)
    at = at or (payment.paid_at if payment and payment.paid_at else timezone.now())
    sub, created = Subscription.objects.get_or_create(
        artist=artist, defaults={"started_at": at, "expires_at": add_year(at)})
    if created:
        SubscriptionPeriod.objects.create(subscription=sub, kind=PeriodKind.SIGNUP, starts_at=at,
                                          ends_at=sub.expires_at, payment=payment)
    return sub


@transaction.atomic
def renew(artist: ArtistProfile, payment=None, kind: str = PeriodKind.RENEWAL, note: str = "") -> Subscription:
    """
    Prolonge d'un an : expires_at = max(expires_at, maintenant) + 1 an, et sort le compte de veille.
    Idempotent pour un même paiement.
    """
    if payment is not None and SubscriptionPeriod.objects.filter(payment=payment).exists():
        return artist.subscription
    now = timezone.now()
    sub = get_subscription(artist)
    if sub is None:  # compte jamais activé : on part de maintenant
        sub = Subscription.objects.create(artist=artist, started_at=now, expires_at=now)
    sub = Subscription.objects.select_for_update().get(pk=sub.pk)
    start = max(sub.expires_at, now)
    sub.expires_at = add_year(start)
    sub.save(update_fields=["expires_at", "updated_at"])
    SubscriptionPeriod.objects.create(subscription=sub, kind=kind, starts_at=start, ends_at=sub.expires_at,
                                      payment=payment, note=note[:255])

    artist = ArtistProfile.objects.select_for_update().get(pk=artist.pk)
    if artist.status == ArtistStatus.DORMANT:
        artist.status = ArtistStatus.ACTIVE
        artist.save(update_fields=["status", "updated_at"])
    sub.artist = artist
    return sub


def request_renewal(artist: ArtistProfile, user, method: str):
    """Crée le paiement du renouvellement et le lance. Renvoie (payment, action)."""
    if artist.status not in (ArtistStatus.ACTIVE, ArtistStatus.DORMANT):
        raise SubscriptionError("renewal_not_allowed", "Ce compte ne peut pas être renouvelé.")
    payment = payments.create_payment(
        purpose="renewal", method=method, quote=quote("renewal", artist.region),
        region=artist.region, artist=artist, payer_user=user,
    )
    try:
        action = payments.start_payment(payment)
    except ProviderError as exc:
        # Débit du Compte d'Avoir refusé (solde insuffisant…) : pas de paiement « en attente » orphelin
        payments.fail_payment(payment, exc.message)
        raise
    return payment, action


def subscription_summary(artist: ArtistProfile) -> dict | None:
    sub = get_subscription(artist)
    if sub is None:
        return None
    now = timezone.now()
    return {
        "opened_at": sub.started_at,
        "expires_at": sub.expires_at,
        "state": state_of(sub, now),
        "days_left": days_left(sub, now),
        "renewal_quote": quote("renewal", artist.region).as_dict(),
    }


# --- Mise en veille et rappels (commande quotidienne) ------------------------

def _notify(artist: ArtistProfile, sms: str, subject: str, body: str) -> None:
    send_sms(artist.user.phone, sms)
    send_email(artist.user.email, subject, body)


def _record_reminder(sub: Subscription, kind: str) -> bool:
    """Enregistre le rappel ; False s'il a déjà été envoyé pour cette échéance."""
    _, created = SubscriptionReminder.objects.get_or_create(subscription=sub, kind=kind, expires_at=sub.expires_at)
    return created


def expire_and_remind(now=None) -> dict:
    """
    À lancer chaque jour : met en veille les comptes arrivés à la date anniversaire et
    envoie les rappels à J-30 et J-7. Renvoie le nombre d'actions effectuées.
    """
    now = now or timezone.now()
    stats = {"backfilled": 0, "expired": 0, "reminded": 0}

    # Comptes actifs créés avant ce module
    for artist in ArtistProfile.objects.filter(status=ArtistStatus.ACTIVE, subscription__isnull=True):
        get_subscription(artist)
        stats["backfilled"] += 1

    active = Subscription.objects.select_related("artist__user").filter(artist__status=ArtistStatus.ACTIVE)

    for sub in active.filter(expires_at__lte=now):
        with transaction.atomic():
            artist = ArtistProfile.objects.select_for_update().get(pk=sub.artist_id)
            if artist.status != ArtistStatus.ACTIVE:
                continue
            artist.status = ArtistStatus.DORMANT
            artist.save(update_fields=["status", "updated_at"])
            first_time = _record_reminder(sub, ReminderKind.EXPIRED)
        stats["expired"] += 1
        if first_time:
            price = quote("renewal", artist.region)
            _notify(
                artist,
                f"AGAPY-GALLERY : votre abonnement annuel est arrivé à échéance, votre compte est en veille. "
                f"Renouvelez-le ({price.ttc} {price.currency} TTC) pour publier à nouveau.",
                "Votre compte AGAPY-GALLERY est en veille",
                f"Bonjour {artist.display_name},\n\nVotre abonnement annuel est arrivé à échéance : votre compte "
                f"est en veille et vous ne pouvez plus publier d'œuvres.\nPour le réactiver, renouvelez votre "
                f"abonnement depuis votre espace artiste ({price.ttc} {price.currency} TTC).\n\nL'équipe AGAPY-GALLERY",
            )

    for sub in active.filter(expires_at__gt=now, expires_at__lte=now + timedelta(days=REMINDER_DAYS[ReminderKind.J30])):
        left = days_left(sub, now)
        kind = ReminderKind.J7 if left <= REMINDER_DAYS[ReminderKind.J7] else ReminderKind.J30
        if not _record_reminder(sub, kind):
            continue
        if kind == ReminderKind.J7:
            _record_reminder(sub, ReminderKind.J30)  # inutile d'envoyer le rappel à 30 jours ensuite
        artist = sub.artist
        date = f"{timezone.localtime(sub.expires_at):%d/%m/%Y}"
        _notify(
            artist,
            f"AGAPY-GALLERY : votre abonnement annuel expire le {date} (dans {left} jour{'s' if left > 1 else ''}). "
            f"Pensez à le renouveler pour continuer à publier.",
            f"Votre abonnement AGAPY-GALLERY expire le {date}",
            f"Bonjour {artist.display_name},\n\nVotre abonnement annuel expire le {date}. Sans renouvellement, "
            f"votre compte sera mis en veille et vous ne pourrez plus publier d'œuvres.\nVous pouvez le renouveler "
            f"dès maintenant depuis votre espace artiste.\n\nL'équipe AGAPY-GALLERY",
        )
        stats["reminded"] += 1
    return stats


# --- Compte d'Avoir ----------------------------------------------------------
# Un Compte d'Avoir appartient à un artiste (Wallet.artist) ou à un visiteur inscrit (Wallet.user).

def ensure_wallet(artist: ArtistProfile) -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(artist=artist,
                                             defaults={"currency": CURRENCY_OF_REGION[artist.region]})
    return wallet


def ensure_visitor_wallet(user) -> Wallet:
    """Compte d'Avoir d'un visiteur inscrit (devise de la zone de son pays)."""
    wallet, _ = Wallet.objects.get_or_create(user=user,
                                             defaults={"currency": CURRENCY_OF_REGION[user.visitor.region]})
    return wallet


def wallet_for_user(user) -> Wallet | None:
    """Compte d'Avoir du compte connecté : celui de son profil artiste ou de son profil visiteur."""
    if user is None or not user.is_authenticated:
        return None
    artist = getattr(user, "artist", None)
    if artist is not None:
        return ensure_wallet(artist)
    if getattr(user, "visitor", None) is not None:
        return ensure_visitor_wallet(user)
    return None


def owner_region(wallet: Wallet) -> str:
    return wallet.artist.region if wallet.artist_id else wallet.user.visitor.region


def set_active(wallet: Wallet, active: bool) -> Wallet:
    if wallet.is_active != active:
        wallet.is_active = active
        wallet.save(update_fields=["is_active", "updated_at"])
    return wallet


def set_wallet_active(artist: ArtistProfile, active: bool) -> Wallet:
    return set_active(ensure_wallet(artist), active)


def clean_topup_amount(raw, currency: str) -> Decimal:
    try:
        amount = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        raise SubscriptionError("invalid_amount", "Montant invalide.")
    if not amount.is_finite() or round_money(amount, currency) != amount:
        raise SubscriptionError("invalid_amount", "Montant invalide.")
    low, high = TOPUP_LIMITS[currency]
    if amount < low:
        raise SubscriptionError("amount_too_low", f"Le montant minimum est de {low} {currency}.")
    if amount > high:
        raise SubscriptionError("amount_too_high", f"Le montant maximum est de {high} {currency}.")
    return amount


def request_wallet_topup(wallet: Wallet, user, amount, method: str):
    """
    Recharge (montant libre, sans TVA) par carte ou mobile money. Renvoie (payment, action).
    Artiste : Payment.artist = l'artiste. Visiteur : Payment.artist vide, payer_user = le visiteur.
    """
    if method not in TOPUP_METHODS:
        raise SubscriptionError("invalid_method", "Recharge possible par carte ou mobile money uniquement.")
    if not wallet.is_active:
        raise SubscriptionError("wallet_inactive", "Activez d'abord votre Compte d'Avoir.")
    amount = clean_topup_amount(amount, wallet.currency)
    payment = payments.create_payment(
        purpose="wallet_topup", method=method, quote=donation_quote(amount, wallet.currency),
        region=owner_region(wallet), artist=wallet.artist, payer_user=user,
    )
    return payment, payments.start_payment(payment)


def request_topup(artist: ArtistProfile, user, amount, method: str):
    return request_wallet_topup(ensure_wallet(artist), user, amount, method)


def _add_entry(wallet: Wallet, amount: Decimal, label: str, payment=None) -> WalletEntry:
    """À appeler sur un wallet verrouillé (select_for_update)."""
    wallet.balance += amount
    wallet.save(update_fields=["balance", "updated_at"])
    return WalletEntry.objects.create(wallet=wallet, amount=amount, balance_after=wallet.balance,
                                      label=label[:200], payment=payment)


def _topup_wallet(payment) -> Wallet | None:
    if payment.artist_id:
        return ensure_wallet(payment.artist)
    user = payment.payer_user
    if user is not None and getattr(user, "visitor", None) is not None:
        return ensure_visitor_wallet(user)
    return None


@transaction.atomic
def credit_topup(payment) -> WalletEntry | None:
    """Crédite une recharge confirmée (artiste ou visiteur). Idempotent."""
    if WalletEntry.objects.filter(payment=payment).exists():
        return None
    wallet = _topup_wallet(payment)
    if wallet is None:
        logger.error("Recharge %s sans Compte d'Avoir associé", payment.reference)
        return None
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
    if wallet.currency != payment.currency:
        # Ne devrait pas arriver : la recharge est toujours créée dans la devise du compte
        raise ProviderError("wallet_currency", "Devise différente de celle du Compte d'Avoir.")
    return _add_entry(wallet, payment.amount_ttc, "Recharge du Compte d'Avoir", payment)


# Paiements où Payment.artist est le BÉNÉFICIAIRE (et non le payeur) : seul le compte connecté peut payer
RECIPIENT_PURPOSES = ("visit", "donation")


def payer_wallet_lookup(payment) -> dict | None:
    """
    Filtre du Compte d'Avoir à débiter : celui du compte qui paie (artiste ou visiteur).
    Pour une visite ou un don, jamais celui de l'artiste bénéficiaire.
    """
    user = payment.payer_user
    if user is not None:
        artist = getattr(user, "artist", None)
        if artist is not None:
            return {"artist": artist}
        if getattr(user, "visitor", None) is not None:
            return {"user": user}
    if payment.purpose in RECIPIENT_PURPOSES:
        return None
    return {"artist_id": payment.artist_id} if payment.artist_id else None


def wallet_owner(payment) -> ArtistProfile | None:
    """Artiste payeur (compatibilité) ; None si le payeur est un visiteur ou inconnu."""
    lookup = payer_wallet_lookup(payment)
    if not lookup or "user" in lookup:
        return None
    return lookup.get("artist") or ArtistProfile.objects.get(pk=lookup["artist_id"])


def _wallet_label(payment) -> str:
    label = payment.get_purpose_display()
    if payment.purpose in RECIPIENT_PURPOSES and payment.artist_id:
        label = f"{label} — {payment.artist.display_name}"
    return label


def pay_with_wallet(payment) -> dict:
    """
    Règle un paiement avec le Compte d'Avoir du payeur (artiste ou visiteur) : débit atomique puis
    confirmation du paiement (même transaction : si une action du module échoue, le débit est annulé).
    """
    from apps.payments.models import Payment, PaymentStatus

    if payment.purpose == "wallet_topup":
        raise ProviderError("wallet_not_allowed", "Une recharge ne peut pas être payée avec le Compte d'Avoir.")
    lookup = payer_wallet_lookup(payment)
    if lookup is None:
        raise ProviderError("wallet_unavailable", "Aucun Compte d'Avoir associé à ce paiement.")

    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if payment.status == PaymentStatus.SUCCEEDED:
            return {"status": "succeeded"}
        if payment.status != PaymentStatus.PENDING:
            raise ProviderError("payment_closed", "Ce paiement n'est plus en attente.")
        wallet = Wallet.objects.select_for_update().filter(**lookup).first()
        if wallet is None or not wallet.is_active:
            raise ProviderError("wallet_inactive", "Votre Compte d'Avoir n'est pas activé.")
        if wallet.currency != payment.currency:
            raise ProviderError("wallet_currency", "La devise du paiement ne correspond pas à celle du Compte d'Avoir.")
        if wallet.balance < payment.amount_ttc:
            raise ProviderError("wallet_insufficient", "Solde du Compte d'Avoir insuffisant.")
        _add_entry(wallet, -payment.amount_ttc, _wallet_label(payment), payment)
        payments.confirm_payment(payment, provider_ref=f"wallet-{wallet.pk}")
    return {"status": "succeeded"}
