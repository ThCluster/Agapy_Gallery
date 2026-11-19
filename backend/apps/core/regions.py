"""
Zones tarifaires (cahier des charges p. 7, 14) : Afrique (F CFA), Europe (€), reste du monde ($).

Miroir de regionOf() dans frontend/src/features/signup/schema.ts. Le backend connaît
tous les pays d'Afrique et d'Europe (UE, EEE, Royaume-Uni, Suisse, micro-États, Balkans,
Europe de l'Est), alors que le frontend n'en propose qu'une sélection. Les pays transcontinentaux
du Caucase et la Turquie restent dans « reste du monde ».
"""
from django.db import models


class Region(models.TextChoices):
    AFRICA = "africa", "Afrique"
    EUROPE = "europe", "Europe"
    WORLD = "world", "Reste du monde"


# Codes ISO 3166-1 alpha-2 des 54 pays d'Afrique
AFRICA = frozenset(
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY "
    "MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW".split()
)

# Pays et territoires européens facturés en euros (codes ISO 3166-1 alpha-2, XK pour le Kosovo)
EUROPE = frozenset(
    # Union européenne (27)
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE "
    # Espace économique européen et AELE
    "IS LI NO CH "
    # Royaume-Uni et micro-États
    "GB MC AD SM VA "
    # Balkans
    "AL BA ME MK RS XK "
    # Europe de l'Est
    "UA MD BY RU "
    # Territoires européens rattachés (Gibraltar, îles Féroé, îles Anglo-Normandes, île de Man, Åland, Svalbard)
    "GI FO GG JE IM AX SJ".split()
)


def region_of(country: str) -> str:
    country = (country or "").upper()
    if country in AFRICA:
        return Region.AFRICA
    if country in EUROPE:
        return Region.EUROPE
    return Region.WORLD
