"""
Calculs des tableaux de bord (artiste et équipe AGAPY) et du bilan trimestriel.

Les revenus de l'artiste sont ses crédits au grand livre (compte "artist") sur les paiements
de visites et de dons. Regroupement par période en Africa/Abidjan : ce fuseau est GMT toute
l'année (pas d'heure d'été), on tronque donc en UTC, ce qui évite d'exiger les tables de
fuseaux de MySQL (CONVERT_TZ) tout en donnant exactement les mêmes bornes.
"""
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncQuarter, TruncWeek, TruncYear
from django.utils import timezone

from apps.accounts.models import ArtistProfile
from apps.catalog.models import Artwork, ArtworkStatus
from apps.core.pricing import CURRENCY_OF_REGION, Currency
from apps.payments.models import Direction, LedgerAccount, LedgerEntry, Payment, PaymentStatus, Purpose, VisitLog
from apps.payments.services import balances

UTC = dt_timezone.utc
CURRENCIES = (Currency.XOF, Currency.EUR, Currency.USD)
PERIODS = ("day", "week", "month", "quarter", "year")
TRUNC = {"day": TruncDay, "week": TruncWeek, "month": TruncMonth, "quarter": TruncQuarter, "year": TruncYear}
DEFAULT_POINTS = 12
MAX_POINTS = 400
REVENUE_PURPOSES = (Purpose.VISIT, Purpose.DONATION)
CENT = Decimal("0.01")

RANKING_PERIODS = PERIODS
RANKING_PERIOD_LABELS = {"day": "Aujourd'hui", "week": "Cette semaine", "month": "Ce mois-ci",
                         "quarter": "Ce trimestre", "year": "Cette année"}


class DashboardError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def money(amount) -> str:
    return str(Decimal(amount or 0).quantize(CENT))


def artist_currency(artist) -> str:
    return CURRENCY_OF_REGION[artist.region]


# ---------------------------------------------------------------------------
# Périodes
# ---------------------------------------------------------------------------
def _add_months(d: date, n: int) -> date:
    m = d.year * 12 + (d.month - 1) + n
    return date(m // 12, m % 12 + 1, 1)


def period_start(d: date, period: str) -> date:
    if period == "day":
        return d
    if period == "week":
        return d - timedelta(days=d.weekday())  # lundi, comme TruncWeek
    if period == "month":
        return d.replace(day=1)
    if period == "quarter":
        return date(d.year, 3 * ((d.month - 1) // 3) + 1, 1)
    return date(d.year, 1, 1)


def shift(start: date, period: str, n: int) -> date:
    """Début de la période située n périodes après (avant si n < 0) celle qui commence à start."""
    if period == "day":
        return start + timedelta(days=n)
    if period == "week":
        return start + timedelta(weeks=n)
    return _add_months(start, n * {"month": 1, "quarter": 3, "year": 12}[period])


def period_starts(start: date, end: date, period: str, limit: int = MAX_POINTS) -> list[date]:
    """Débuts des périodes de start (aligné) à end inclus ; lève range_too_large au-delà de limit."""
    starts, current = [], period_start(start, period)
    while current <= end:
        starts.append(current)
        if len(starts) > limit:
            raise DashboardError("range_too_large", f"Trop de points demandés (maximum {limit}).")
        current = shift(current, period, 1)
    return starts


def day_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return (datetime.combine(start, time.min, tzinfo=UTC),
            datetime.combine(end + timedelta(days=1), time.min, tzinfo=UTC))


def _as_date(value) -> date:
    if isinstance(value, datetime):
        return value.astimezone(UTC).date() if timezone.is_aware(value) else value.date()
    return value


# ---------------------------------------------------------------------------
# Tableau de bord de l'artiste
# ---------------------------------------------------------------------------
def _artist_revenue_entries(artist):
    return LedgerEntry.objects.filter(artist=artist, account=LedgerAccount.ARTIST, direction=Direction.CREDIT,
                                      payment__purpose__in=REVENUE_PURPOSES)


def artist_summary(artist) -> dict:
    currency = artist_currency(artist)
    balance = next((b for b in balances(artist) if b["currency"] == currency), None)
    visits = VisitLog.objects.filter(artist=artist).aggregate(
        total=Count("pk"), free=Count("pk", filter=Q(free=True)),
        last_30=Count("pk", filter=Q(created_at__gte=timezone.now() - timedelta(days=30))),
    )
    donations = (_artist_revenue_entries(artist).filter(currency=currency, payment__purpose=Purpose.DONATION)
                 .aggregate(count=Count("payment", distinct=True), total=Sum("amount")))
    by_status = dict(Artwork.objects.filter(artist=artist).order_by().values_list("status")
                     .annotate(n=Count("pk")))
    total_views = Artwork.objects.filter(artist=artist).aggregate(v=Sum("view_count"))["v"] or 0
    top = (Artwork.objects.filter(artist=artist, status=ArtworkStatus.PUBLISHED)
           .order_by("-view_count", "-published_at").values("slug", "title", "view_count")[:5])
    return {
        "currency": currency,
        "available_balance": money(balance["available"] if balance else 0),
        "total_earned": money(balance["total_earned"] if balance else 0),
        "provision_held": money(balance["provision"] if balance else 0),
        "visits": {"total": visits["total"], "paid": visits["total"] - visits["free"], "free": visits["free"],
                   "last_30_days": visits["last_30"]},
        "donations": {"count": donations["count"] or 0, "total": money(donations["total"])},
        "artworks": {
            "published": by_status.get(ArtworkStatus.PUBLISHED, 0),
            "pending_review": by_status.get(ArtworkStatus.PENDING_REVIEW, 0),
            "rejected": by_status.get(ArtworkStatus.REJECTED, 0),
            # Brouillons et œuvres dont la publication n'est pas encore payée
            "draft": by_status.get(ArtworkStatus.DRAFT, 0) + by_status.get(ArtworkStatus.AWAITING_PAYMENT, 0),
            "total_views": total_views,
        },
        "top_artworks": [{"id": a["slug"], "title": a["title"], "view_count": a["view_count"]} for a in top],
    }


def artist_revenue(artist, period: str = "month", start: date | None = None, end: date | None = None,
                   currency: str | None = None) -> dict:
    if period not in PERIODS:
        raise DashboardError("invalid_period", "Période inconnue.")
    zone_currency = artist_currency(artist)
    currency = currency or zone_currency
    if currency not in CURRENCIES:
        raise DashboardError("invalid_currency", "Devise inconnue.")
    end = end or timezone.localdate()
    if start is None:
        start = shift(period_start(end, period), period, -(DEFAULT_POINTS - 1))
    if start > end:
        raise DashboardError("invalid_range", "La date de début doit précéder la date de fin.")
    starts = period_starts(start, end, period)
    lo, hi = day_bounds(starts[0], end)
    trunc = TRUNC[period]

    rows = (_artist_revenue_entries(artist).filter(currency=currency, created_at__gte=lo, created_at__lt=hi)
            .annotate(p=trunc("created_at", tzinfo=UTC)).order_by()
            .values("p", "payment__purpose").annotate(s=Sum("amount")))
    amounts: dict[tuple[date, str], Decimal] = {}
    for r in rows:
        key = (_as_date(r["p"]), r["payment__purpose"])
        amounts[key] = amounts.get(key, Decimal("0")) + (r["s"] or 0)
    visit_rows = (VisitLog.objects.filter(artist=artist, created_at__gte=lo, created_at__lt=hi)
                  .annotate(p=trunc("created_at", tzinfo=UTC)).order_by().values("p").annotate(n=Count("pk")))
    counts: dict[date, int] = {}
    for r in visit_rows:
        counts[_as_date(r["p"])] = counts.get(_as_date(r["p"]), 0) + r["n"]

    series, tv, td, tc = [], Decimal("0"), Decimal("0"), 0
    for s in starts:
        v = amounts.get((s, Purpose.VISIT), Decimal("0"))
        d = amounts.get((s, Purpose.DONATION), Decimal("0"))
        c = counts.get(s, 0)
        tv, td, tc = tv + v, td + d, tc + c
        series.append({"start": s.isoformat(), "visits": money(v), "donations": money(d), "total": money(v + d),
                       "visit_count": c})

    earned = set(_artist_revenue_entries(artist).order_by().values_list("currency", flat=True).distinct())
    currencies = [zone_currency] + sorted(earned - {zone_currency})
    return {
        "currency": currency, "currencies": currencies, "period": period,
        "from": starts[0].isoformat(), "to": end.isoformat(), "series": series,
        "totals": {"visits": money(tv), "donations": money(td), "total": money(tv + td), "visit_count": tc},
    }


# ---------------------------------------------------------------------------
# Tableau de bord de l'équipe AGAPY
# ---------------------------------------------------------------------------
def _since(period: str) -> datetime:
    return datetime.combine(period_start(timezone.localdate(), period), time.min, tzinfo=UTC)


def _by_currency(qs, field="amount") -> dict:
    return {r["currency"]: money(r["s"])
            for r in qs.order_by().values("currency").annotate(s=Sum(field)).order_by("currency")}


def staff_figures(since: datetime) -> dict:
    paid = Payment.objects.filter(status=PaymentStatus.SUCCEEDED, paid_at__gte=since)
    labels = dict(Purpose.choices)
    by_purpose: dict[str, dict] = {}
    rows = (paid.order_by().values("purpose", "currency").annotate(n=Count("pk"), s=Sum("amount_ttc"))
            .order_by("purpose", "currency"))
    for r in rows:
        item = by_purpose.setdefault(r["purpose"], {"purpose": r["purpose"], "label": labels.get(r["purpose"], ""),
                                                    "count": 0, "totals": {}})
        item["count"] += r["n"]
        item["totals"][r["currency"]] = money(r["s"])
    ledger = LedgerEntry.objects.filter(direction=Direction.CREDIT, created_at__gte=since)
    return {
        "from": since.date().isoformat(),
        "payments": list(by_purpose.values()),  # montants TTC encaissés, par objet et par devise
        "agapy_revenue": _by_currency(ledger.filter(account=LedgerAccount.AGAPY)),
        "agapy_provision": _by_currency(ledger.filter(account=LedgerAccount.AGAPY_PROVISION)),
        "new_signups": ArtistProfile.objects.filter(created_at__gte=since).count(),
        "new_activations": ArtistProfile.objects.filter(activated_at__gte=since).count(),
    }


def staff_rankings(since: datetime, currency: str, limit: int = 20) -> dict:
    revenue = list(
        LedgerEntry.objects.filter(account=LedgerAccount.ARTIST, direction=Direction.CREDIT,
                                   payment__purpose__in=REVENUE_PURPOSES, currency=currency,
                                   created_at__gte=since, artist__isnull=False)
        .order_by().values("artist").annotate(total=Sum("amount")).order_by("-total", "artist")[:limit]
    )
    visits = list(
        VisitLog.objects.filter(created_at__gte=since).order_by().values("artist")
        .annotate(total=Count("pk"), free=Count("pk", filter=Q(free=True))).order_by("-total", "artist")[:limit]
    )
    ids = {r["artist"] for r in revenue} | {r["artist"] for r in visits}
    artists = {a.pk: a for a in ArtistProfile.objects.filter(pk__in=ids)}

    def ident(pk):
        a = artists.get(pk)
        return {"id": a.slug if a else None, "name": a.display_name if a else "", "admin_id": pk}

    return {
        "by_revenue": [{"rank": i, **ident(r["artist"]), "total": money(r["total"])}
                       for i, r in enumerate(revenue, 1)],
        "by_visits": [{"rank": i, **ident(r["artist"]), "visits": r["total"], "paid": r["total"] - r["free"],
                       "free": r["free"]} for i, r in enumerate(visits, 1)],
    }


def staff_overview(period: str = "month", currency: str = Currency.XOF) -> dict:
    if period not in RANKING_PERIODS:
        raise DashboardError("invalid_period", "Période inconnue.")
    if currency not in CURRENCIES:
        raise DashboardError("invalid_currency", "Devise inconnue.")
    since = _since(period)
    return {
        "period": period, "currency": currency, "from": since.date().isoformat(),
        "figures": {p: staff_figures(_since(p)) for p in ("day", "week", "month")},
        "pending_moderation": Artwork.objects.filter(status=ArtworkStatus.PENDING_REVIEW).count(),
        "rankings": staff_rankings(since, currency),
    }


# ---------------------------------------------------------------------------
# Bilan trimestriel
# ---------------------------------------------------------------------------
INACTIVITY_DAYS = 90
CURRENCY_LABEL = {Currency.XOF: "F CFA", Currency.EUR: "€", Currency.USD: "$"}


def quarter_label(d: date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def format_amount(amount, currency: str) -> str:
    """30000 XOF → « 30 000 F CFA » ; 12.5 EUR → « 12,50 € »."""
    if currency == Currency.XOF:
        text = f"{int(Decimal(amount).quantize(Decimal('1'))):,}".replace(",", " ")
    else:
        text = f"{Decimal(amount).quantize(CENT):,}".replace(",", " ").replace(".", ",")
    return f"{text} {CURRENCY_LABEL.get(currency, currency)}"


def is_inactive(artist, now=None) -> bool:
    cutoff = (now or timezone.now()) - timedelta(days=INACTIVITY_DAYS)
    return not Artwork.objects.filter(artist=artist, published_at__gte=cutoff).exists()


def statement_message(artist, now=None) -> str:
    zone = artist_currency(artist)
    available = {b["currency"]: b["available"] for b in balances(artist)}
    parts = [format_amount(available.get(zone, Decimal("0")), zone)]
    parts += [format_amount(v, c) for c, v in sorted(available.items()) if c != zone and v > 0]
    message = f"Message AGAPY-GALLERY : vous avez une disponibilité financière de {' et '.join(parts)}."
    if is_inactive(artist, now):
        message += (" Cela fait un moment que vous n'avez pas publié d'œuvre : vos visiteurs attendent "
                    "vos nouvelles créations sur AGAPY-GALLERY.")
    return message
