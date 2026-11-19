"""
Zones tarifaires (cahier des charges p. 7, 14) : Afrique (F CFA), Europe (€), reste du monde ($).

Miroir de regionOf() dans frontend/src/features/signup/schema.ts. Le backend connaît
tous les pays africains, alors que le frontend n'en propose qu'une sélection.
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

# Pays européens facturés en euros (liste du frontend)
EUROPE = frozenset("FR BE CH DE ES IT GB PT NL LU".split())


def region_of(country: str) -> str:
    country = (country or "").upper()
    if country in AFRICA:
        return Region.AFRICA
    if country in EUROPE:
        return Region.EUROPE
    return Region.WORLD
