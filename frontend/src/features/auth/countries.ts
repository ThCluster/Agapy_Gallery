import { getCountries, type CountryCode } from 'libphonenumber-js'

/** Nom du pays dans la langue de l'interface */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Codes ISO 3166-1 alpha-2 des 54 pays d'Afrique (même liste que backend/apps/core/regions.py) */
const AFRICA_ALL =
  'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW'.split(
    ' ',
  ) as CountryCode[]

/** Cible prioritaire, en tête de liste */
const AFRICA_FIRST: CountryCode[] = ['CI', 'SN', 'CM', 'ML', 'BF', 'BJ', 'TG', 'GN', 'NE', 'GA', 'CG', 'CD']

const byName = (codes: CountryCode[]) => {
  const collator = new Intl.Collator('fr')
  return [...codes].sort((a, b) => collator.compare(countryName(a, 'fr'), countryName(b, 'fr')))
}

/** Tous les pays connus (indicatifs téléphoniques de libphonenumber, codes ISO) */
const ALL = new Set<CountryCode>(getCountries())

/** Pays d'Afrique : la cible prioritaire d'abord, puis les autres par ordre alphabétique */
export const AFRICA: CountryCode[] = [
  ...AFRICA_FIRST,
  ...byName(AFRICA_ALL.filter((c) => ALL.has(c) && !AFRICA_FIRST.includes(c))),
]

/** Reste du monde : tous les autres pays, par ordre alphabétique */
export const OTHERS: CountryCode[] = byName([...ALL].filter((c) => !AFRICA_ALL.includes(c)))
