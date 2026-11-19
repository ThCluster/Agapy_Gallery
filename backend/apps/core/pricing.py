"""
Tarifs et clés de répartition du cahier des charges, en un seul endroit.

Miroir de frontend/src/lib/pricing.ts. Tous les montants sont HT ; la TVA (20 %) est ajoutée
par quote(). Les montants sont des Decimal pour éviter les erreurs d'arrondi.

Note : pour la publication, le cahier des charges cite 5 000 F HT dans le texte mais 2 500 F HT
dans la facture d'exemple (p. 9). On retient 2 500 F, comme le frontend.
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .regions import Region

VAT_RATE = Decimal("0.20")


class Currency:
    XOF = "XOF"
    EUR = "EUR"
    USD = "USD"


CURRENCY_OF_REGION = {Region.AFRICA: Currency.XOF, Region.EUROPE: Currency.EUR, Region.WORLD: Currency.USD}

# Précision : le F CFA n'a pas de centimes
DECIMALS = {Currency.XOF: Decimal("1"), Currency.EUR: Decimal("0.01"), Currency.USD: Decimal("0.01")}

# (Afrique en F CFA, Europe en €, reste du monde en $) — montants HT
TARIFFS = {
    "signup": ("10000", "30", "35"),       # ouverture du compte, une publication gratuite incluse (p. 7, 14)
    "renewal": ("10000", "30", "35"),      # renouvellement annuel du droit de publication (p. 8)
    "publication": ("2500", "20", "25"),   # publication d'une œuvre (p. 9)
    "visit": ("250", "1", "1.5"),          # visite d'une galerie (p. 12)
}

# Clip de 30 s sur l'accueil pendant 24 h : montants fixés tels quels (p. 16), même prix pour tous
CLIP_PRICE = {"ht": Decimal("3000"), "ttc": Decimal("3300"), "currency": Currency.XOF}
CLIP_DURATION_HOURS = 24
CLIP_MAX_SECONDS = 30
CLIP_SLOTS = 50

# Répartition d'une visite, en % du montant HT (p. 12)
VISIT_SPLIT = {
    "artist": Decimal("75"),
    "copyright_office": Decimal("2"),
    "provision": Decimal("2"),          # compte de provision (réclamations des autres ayants droit), tracé par artiste
    "agapy": Decimal("20"),
    "agapy_provision": Decimal("1"),
}

# Répartition d'un don (p. 11) : pas de TVA sur un don
DONATION_SPLIT = {"artist": Decimal("85"), "agapy": Decimal("15")}

# Compteur public d'artistes : affiché au minimum à 1 500 (p. 18)
ARTIST_COUNTER_FLOOR = 1500


def round_money(amount: Decimal, currency: str) -> Decimal:
    return Decimal(amount).quantize(DECIMALS[currency], rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Quote:
    """Montant d'une facture : HT, TVA, TTC, dans la devise de la zone."""

    ht: Decimal
    vat: Decimal
    ttc: Decimal
    currency: str

    def as_dict(self) -> dict:
        return {"amount_ht": str(self.ht), "vat": str(self.vat), "amount_ttc": str(self.ttc), "currency": self.currency}


def make_quote(ht, currency: str, vat_rate: Decimal = VAT_RATE) -> Quote:
    ht = round_money(Decimal(ht), currency)
    vat = round_money(ht * vat_rate, currency)
    return Quote(ht=ht, vat=vat, ttc=ht + vat, currency=currency)


def quote(kind: str, region: str) -> Quote:
    """Facture d'un tarif du cahier des charges (signup, renewal, publication, visit) pour une zone."""
    index = {Region.AFRICA: 0, Region.EUROPE: 1, Region.WORLD: 2}[region]
    currency = CURRENCY_OF_REGION[region]
    return make_quote(TARIFFS[kind][index], currency)


def clip_quote() -> Quote:
    ht, ttc = CLIP_PRICE["ht"], CLIP_PRICE["ttc"]
    return Quote(ht=ht, vat=ttc - ht, ttc=ttc, currency=CLIP_PRICE["currency"])


def donation_quote(amount, currency: str) -> Quote:
    return make_quote(amount, currency, vat_rate=Decimal("0"))


def split(amount: Decimal, keys: dict, currency: str) -> dict:
    """
    Répartit `amount` selon des pourcentages. Le reste d'arrondi va à « agapy » pour que
    la somme des parts soit toujours exactement égale au montant.
    """
    parts = {k: round_money(amount * pct / 100, currency) for k, pct in keys.items()}
    parts["agapy"] += amount - sum(parts.values())
    return parts
