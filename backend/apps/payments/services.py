"""
Cycle de vie d'un paiement : création → lancement chez le prestataire → confirmation.

Contrat utilisé par tous les modules :

    from apps.payments import services as payments
    from apps.core.pricing import quote

    payment = payments.create_payment(
        purpose="publication", method="momo", quote=quote("publication", artist.region),
        region=artist.region, artist=artist, payer_user=request.user, target=artwork,
    )
    action = payments.start_payment(payment)   # → {"checkout_url": ...} ou {"status": "succeeded"}

La confirmation (webhook du prestataire ou paiement immédiat) appelle confirm_payment(),
qui exécute les fonctions @on_paid du module concerné. Elle est idempotente.
"""
import hashlib
import logging
import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from django.utils.module_loading import import_string

from apps.core.pricing import (
    CURRENCY_OF_REGION, DONATION_SPLIT, VISIT_SPLIT, Currency, Quote, donation_quote, quote, round_money, split,
)

from .models import (
    Direction, LedgerAccount, LedgerEntry, Payment, PaymentStatus, PayoutChannel, PayoutRequest, PayoutStatus,
    Purpose, VisitLog, VisitPass,
)
from .providers import ProviderError, get_provider
from .registry import run_handlers

logger = logging.getLogger("agapy.payments")


def create_payment(*, purpose: str, method: str, quote: Quote, region: str, artist=None, payer_user=None,
                   target=None, payer_name: str = "", payer_email: str = "", payer_phone: str = "",
                   metadata: dict | None = None) -> Payment:
    get_provider(method)  # refuse tout de suite un moyen de paiement non configuré
    payment = Payment(
        purpose=purpose, method=method, region=region, currency=quote.currency,
        amount_ht=quote.ht, vat=quote.vat, amount_ttc=quote.ttc,
        artist=artist, payer_user=payer_user if payer_user and payer_user.is_authenticated else None,
        payer_name=payer_name, payer_email=payer_email, payer_phone=payer_phone,
        metadata=metadata or {},
    )
    if target is not None:
        payment.target_type = ContentType.objects.get_for_model(target)
        payment.target_id = target.pk
    payment.save()
    return payment


def start_payment(payment: Payment) -> dict:
    provider = get_provider(payment.method)
    if payment.provider != provider.name:
        payment.provider = provider.name
        payment.save(update_fields=["provider"])
    return provider.start(payment)


@transaction.atomic
def confirm_payment(payment: Payment, provider_ref: str = "") -> Payment:
    """Marque le paiement comme payé et exécute les actions du module. Sans effet s'il l'est déjà."""
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.status == PaymentStatus.SUCCEEDED:
        return payment
    if payment.status != PaymentStatus.PENDING:
        logger.warning("Confirmation reçue pour un paiement %s : %s", payment.status, payment.reference)
        return payment
    payment.status = PaymentStatus.SUCCEEDED
    payment.paid_at = timezone.now()
    if provider_ref:
        payment.provider_ref = provider_ref
    payment.save(update_fields=["status", "paid_at", "provider_ref"])
    run_handlers(payment)
    logger.info("Paiement confirmé : %s (%s)", payment.reference, payment.purpose)
    return payment


@transaction.atomic
def fail_payment(payment: Payment, reason: str = "", status: str = PaymentStatus.FAILED) -> Payment:
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.status == PaymentStatus.PENDING:
        payment.status = status
        payment.failure_reason = reason[:255]
        payment.save(update_fields=["status", "failure_reason"])
    return payment


# ===========================================================================
# Règles métier du module : ouverture de compte, visites, dons, répartition, versements
# ===========================================================================
# Durée d'un droit de visite payé (réglable avec settings.VISIT_PASS_LIFETIME)
VISIT_PASS_LIFETIME = timedelta(hours=24)

# Moyens proposés aux visiteurs anonymes et aux nouveaux inscrits. Le Compte d'Avoir exige un compte
# connecté (visiteur inscrit ou artiste) : voir _visitor_payment_context (visites et dons).
PUBLIC_METHODS = ("card", "momo")

# Montants de don acceptés, par devise
DONATION_LIMITS = {
    Currency.XOF: (Decimal("100"), Decimal("5000000")),
    Currency.EUR: (Decimal("1"), Decimal("10000")),
    Currency.USD: (Decimal("1"), Decimal("10000")),
}
# Tant que le paiement est simulé (settings.PAYMENT_SIMULATION_ENABLED), les dons sont plafonnés plus bas :
# l'argent est fictif, inutile de laisser afficher des montants extravagants.
SIMULATED_DONATION_MAX = {
    Currency.XOF: Decimal("50000"),
    Currency.EUR: Decimal("100"),
    Currency.USD: Decimal("100"),
}
# Prestataire du paiement simulé (apps.payments.providers.fake.FakeProvider)
SIMULATED_PROVIDER = "fake"
# Un paiement simulé doit être confirmé ou refusé dans ce délai après sa création
SIMULATION_WINDOW = timedelta(hours=2)
PAYOUTS_DISABLED_MESSAGE = "Les retraits seront ouverts quand le paiement en ligne réel sera activé."

# Une visite gratuite n'est comptée qu'une fois par visiteur (adresse IP) et par artiste sur cette durée
FREE_VISIT_DEDUP_SECONDS = 6 * 3600

# Frais encaissés entièrement par AGAPY
AGAPY_FEES = (Purpose.SIGNUP, Purpose.RENEWAL, Purpose.PUBLICATION, Purpose.CLIP)


class PaymentError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def visit_pass_lifetime() -> timedelta:
    return getattr(settings, "VISIT_PASS_LIFETIME", VISIT_PASS_LIFETIME)


def gallery_is_free(artist) -> bool:
    """Galerie en visite gratuite ? Sans galerie (module catalogue absent), elle est payante."""
    gallery = getattr(artist, "gallery", None)
    return bool(gallery is not None and getattr(gallery, "currently_free", False))


def _check_public_method(method: str) -> None:
    if method not in PUBLIC_METHODS:
        raise ProviderError("method_unavailable", "Ce moyen de paiement n'est pas disponible ici.")


def _visitor_payment_context(method: str, region: str, payer_user) -> tuple[str, object]:
    """
    Visites et dons. Carte / mobile money : pour tous. Compte d'Avoir : seulement pour un compte connecté
    (visiteur ou artiste) dont le Compte d'Avoir est activé ; la zone tarifaire est alors celle du compte
    (devise du Compte d'Avoir), quelle que soit la zone envoyée. Renvoie (region, payer_user).
    """
    user = payer_user if payer_user is not None and payer_user.is_authenticated else None
    if method != "wallet":
        return region, user
    if user is None:
        raise ProviderError("method_unavailable", "Connectez-vous pour payer avec votre Compte d'Avoir.")
    from apps.subscriptions.services import owner_region, wallet_for_user

    wallet = wallet_for_user(user)
    if wallet is None:
        raise ProviderError("method_unavailable", "Aucun Compte d'Avoir associé à ce compte.")
    if not wallet.is_active:
        raise ProviderError("wallet_inactive", "Votre Compte d'Avoir n'est pas activé.")
    return owner_region(wallet), user


# ---------------------------------------------------------------------------
# Ouverture de compte
# ---------------------------------------------------------------------------
def create_signup_payment(artist, method: str) -> Payment:
    from apps.accounts.models import ArtistStatus

    if artist.status != ArtistStatus.PENDING_PAYMENT:
        raise PaymentError("not_pending_payment", "Ce compte n'attend pas de paiement d'ouverture.")
    _check_public_method(method)
    return create_payment(
        purpose=Purpose.SIGNUP, method=method, quote=quote("signup", artist.region), region=artist.region,
        artist=artist, payer_name=artist.display_name, payer_email=artist.user.email, payer_phone=artist.user.phone,
    )


# ---------------------------------------------------------------------------
# Visites
# ---------------------------------------------------------------------------
def create_visit_payment(artist, method: str, region: str, payer: dict, payer_user=None) -> Payment:
    region, payer_user = _visitor_payment_context(method, region, payer_user)
    return create_payment(purpose=Purpose.VISIT, method=method, quote=quote("visit", region), region=region,
                          artist=artist, payer_user=payer_user, **payer)


def issue_visit_pass(payment: Payment) -> VisitPass:
    """Crée le droit de visite d'un paiement confirmé (une seule fois par paiement) et compte la visite."""
    existing = VisitPass.objects.filter(payment=payment).first()
    if existing:
        return existing
    visit_pass = VisitPass.objects.create(
        token=secrets.token_urlsafe(32), artist=payment.artist, payment=payment,
        expires_at=timezone.now() + visit_pass_lifetime(),
    )
    VisitLog.objects.create(artist=payment.artist, free=False, payment=payment)
    return visit_pass


def check_visit_access(artist, token: str | None) -> dict:
    """
    Droit de visite d'une galerie : gratuite → accès direct ; payante → jeton valide exigé.
    Lève PaymentError("visit_token_invalid") si un jeton est fourni mais invalide ou expiré.
    """
    if gallery_is_free(artist):
        return {"access": True, "free": True, "expires_at": None}
    if not token:
        return {"access": False, "free": False, "expires_at": None}
    visit_pass = VisitPass.objects.filter(token=token, artist=artist, expires_at__gt=timezone.now()).first()
    if visit_pass is None:
        raise PaymentError("visit_token_invalid", "Droit de visite invalide ou expiré.")
    return {"access": True, "free": False, "expires_at": visit_pass.expires_at}


def log_free_visit(artist, visitor_key: str = "") -> None:
    """Compte une visite gratuite, une seule fois par visiteur et par artiste sur quelques heures."""
    if visitor_key:
        digest = hashlib.sha256(f"{artist.pk}:{visitor_key}".encode()).hexdigest()
        if not cache.add(f"free-visit:{digest}", 1, timeout=FREE_VISIT_DEDUP_SECONDS):
            return
    VisitLog.objects.create(artist=artist, free=True)


# ---------------------------------------------------------------------------
# Dons
# ---------------------------------------------------------------------------
def create_donation_payment(artist, amount: Decimal, currency: str, region: str, method: str, payer: dict,
                            message: str = "", payer_user=None) -> Payment:
    if payer_user is not None and getattr(payer_user, "artist", None) == artist:
        raise PaymentError("self_donation", "Vous ne pouvez pas vous faire un don.")
    region, payer_user = _visitor_payment_context(method, region, payer_user)
    if method == "wallet":  # devise du Compte d'Avoir
        currency = CURRENCY_OF_REGION[region]
    low, high = DONATION_LIMITS[currency]
    if settings.PAYMENT_SIMULATION_ENABLED:
        high = min(high, SIMULATED_DONATION_MAX[currency])
    if amount != round_money(amount, currency) or not (low <= amount <= high):
        raise PaymentError("invalid_amount", f"Le don doit être compris entre {low} et {high} {currency}.")
    return create_payment(purpose=Purpose.DONATION, method=method, quote=donation_quote(amount, currency),
                          region=region, artist=artist, payer_user=payer_user,
                          metadata={"message": message} if message else None, **payer)


# ---------------------------------------------------------------------------
# Répartition (appelée par payment_handlers à la confirmation)
# ---------------------------------------------------------------------------
def record_revenue(payment: Payment) -> list[LedgerEntry]:
    """Écrit la répartition d'un paiement confirmé au grand livre. Sans effet si elle existe déjà."""
    if payment.ledger_entries.exists():
        return []
    if payment.purpose == Purpose.VISIT:
        parts = split(payment.amount_ht, VISIT_SPLIT, payment.currency)
    elif payment.purpose == Purpose.DONATION:
        parts = split(payment.amount_ht, DONATION_SPLIT, payment.currency)
    elif payment.purpose in AGAPY_FEES:
        parts = {LedgerAccount.AGAPY: payment.amount_ht}
    else:  # recharge du Compte d'Avoir : un dépôt, pas un revenu
        return []
    if payment.vat:
        parts[LedgerAccount.VAT] = payment.vat
    label = payment.get_purpose_display()
    entries = [
        LedgerEntry(payment=payment, artist=payment.artist, account=account, amount=amount,
                    currency=payment.currency, direction=Direction.CREDIT, label=label)
        for account, amount in parts.items() if amount
    ]
    return LedgerEntry.objects.bulk_create(entries)


# ---------------------------------------------------------------------------
# Solde et versements de l'artiste
# ---------------------------------------------------------------------------
def _sum(qs) -> Decimal:
    return qs.aggregate(t=Sum("amount"))["t"] or Decimal("0")


def balances(artist, exclude_simulated: bool = False) -> list[dict]:
    """
    Par devise : disponible (crédits − versements − demandes en cours), total gagné, provision retenue.
    exclude_simulated : ignore les crédits issus du paiement simulé (argent fictif).
    """
    entries = LedgerEntry.objects.filter(artist=artist)
    if exclude_simulated:
        entries = entries.exclude(payment__provider=SIMULATED_PROVIDER)
    currencies = set(entries.values_list("currency", flat=True)) | set(
        artist.payout_requests.values_list("currency", flat=True))
    result = []
    for currency in sorted(currencies):
        own = entries.filter(currency=currency, account=LedgerAccount.ARTIST)
        earned = _sum(own.filter(direction=Direction.CREDIT))
        paid_out = _sum(own.filter(direction=Direction.DEBIT))
        pending = _sum(artist.payout_requests.filter(currency=currency, status=PayoutStatus.PENDING))
        prov = entries.filter(currency=currency, account=LedgerAccount.PROVISION)
        provision = _sum(prov.filter(direction=Direction.CREDIT)) - _sum(prov.filter(direction=Direction.DEBIT))
        result.append({
            "currency": currency,
            "available": earned - paid_out - pending,
            "pending_payouts": pending,
            "paid_out": paid_out,
            "total_earned": earned,
            "provision": provision,
        })
    return result


def available_balance(artist, currency: str) -> Decimal:
    return next((b["available"] for b in balances(artist) if b["currency"] == currency), Decimal("0"))


def artist_transactions(artist):
    """Paiements reçus (visites et dons confirmés) et payés par l'artiste (frais), avec sa part."""
    received = [Purpose.VISIT, Purpose.DONATION]
    return (
        Payment.objects.filter(artist=artist)
        .filter(Q(purpose__in=received, status=PaymentStatus.SUCCEEDED) | ~Q(purpose__in=received))
        .annotate(artist_share=Sum("ledger_entries__amount", filter=Q(
            ledger_entries__account=LedgerAccount.ARTIST, ledger_entries__direction=Direction.CREDIT)))
        .order_by("-created_at")
    )


@transaction.atomic
def request_payout(artist, amount: Decimal, currency: str, channel: str) -> PayoutRequest:
    from apps.accounts.models import ArtistProfile

    if settings.PAYMENT_SIMULATION_ENABLED:
        # Paiement simulé : les soldes sont fictifs, aucun retrait réel ne doit en sortir
        raise PaymentError("payouts_disabled", PAYOUTS_DISABLED_MESSAGE)
    artist = ArtistProfile.objects.select_for_update().get(pk=artist.pk)  # une demande à la fois
    if currency not in DONATION_LIMITS or amount <= 0 or amount != round_money(amount, currency):
        raise PaymentError("invalid_amount", "Montant invalide.")
    if channel == PayoutChannel.MOMO:
        if not (artist.payout_momo and artist.momo_number):
            raise PaymentError("payout_channel_missing", "Renseignez votre compte mobile money dans votre profil.")
        destination = f"{artist.momo_operator} {artist.momo_number}".strip()
    else:
        if not (artist.payout_iban and artist.iban):
            raise PaymentError("payout_channel_missing", "Renseignez votre IBAN dans votre profil.")
        destination = " — ".join(x for x in (artist.iban, artist.account_holder, artist.bank_name) if x)
    if amount > available_balance(artist, currency):
        raise PaymentError("insufficient_balance", "Solde insuffisant.")
    return PayoutRequest.objects.create(artist=artist, amount=amount, currency=currency, channel=channel,
                                        destination=destination[:255])


@transaction.atomic
def mark_payout_paid(payout: PayoutRequest, by=None) -> bool:
    """
    Le versement a été effectué : débit au grand livre. Sans effet s'il n'est plus en attente.

    Refusé (PaymentError) tant que le paiement est simulé, ou si la demande n'est pas couverte
    par des crédits issus de paiements réels.
    """
    if settings.PAYMENT_SIMULATION_ENABLED:
        raise PaymentError("payouts_disabled", PAYOUTS_DISABLED_MESSAGE)
    payout = PayoutRequest.objects.select_for_update().get(pk=payout.pk)
    if payout.status != PayoutStatus.PENDING:
        return False
    real = next((b["available"] for b in balances(payout.artist, exclude_simulated=True)
                 if b["currency"] == payout.currency), Decimal("0"))
    if real < 0:  # « disponible » réel, cette demande déduite
        raise PaymentError("simulated_funds",
                           "Cette demande n'est pas couverte par des paiements réels (paiements simulés).")
    payout.status = PayoutStatus.PAID
    payout.processed_at = timezone.now()
    payout.processed_by = by
    payout.save(update_fields=["status", "processed_at", "processed_by"])
    LedgerEntry.objects.create(payout=payout, artist=payout.artist, account=LedgerAccount.ARTIST,
                               amount=payout.amount, currency=payout.currency, direction=Direction.DEBIT,
                               label=f"Versement {payout.get_channel_display()}")
    return True


@transaction.atomic
def reject_payout(payout: PayoutRequest, by=None, note: str = "") -> bool:
    payout = PayoutRequest.objects.select_for_update().get(pk=payout.pk)
    if payout.status != PayoutStatus.PENDING:
        return False
    payout.status = PayoutStatus.REJECTED
    payout.processed_at = timezone.now()
    payout.processed_by = by
    payout.note = note[:255]
    payout.save(update_fields=["status", "processed_at", "processed_by", "note"])
    return True


# ---------------------------------------------------------------------------
# Notifications des prestataires
# ---------------------------------------------------------------------------
def provider_by_name(name: str):
    """Prestataire configuré portant ce nom (ex. "fake", "cinetpay"), ou None."""
    for path in dict.fromkeys(settings.PAYMENT_PROVIDERS.values()):
        try:
            cls = import_string(path)
        except ImportError:
            continue
        if getattr(cls, "name", None) == name:
            return cls()
    return None


def handle_webhook(provider, request) -> Payment | None:
    """Applique une notification du prestataire. Idempotent (confirm_payment/fail_payment le sont)."""
    reference, paid, provider_ref = provider.parse_webhook(request)
    payment = Payment.objects.filter(reference=reference, provider=provider.name).first()
    if payment is None:
        return None
    if paid:
        return confirm_payment(payment, provider_ref)
    return fail_payment(payment, "Refusé par le prestataire")
