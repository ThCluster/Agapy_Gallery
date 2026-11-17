import { create } from 'zustand'
import { formatXOF } from './format'

/**
 * Tarifs du cahier des charges. Les prix dépendent de la zone du visiteur
 * ou de l'artiste : Afrique (F CFA), Europe (€) ou reste du monde ($).
 */
export type Region = 'africa' | 'europe' | 'world'
export type Currency = 'XOF' | 'EUR' | 'USD'

interface Price {
  amount: number
  currency: Currency
}

const zone = (africa: number, europe: number, world: number): Record<Region, Price> => ({
  africa: { amount: africa, currency: 'XOF' },
  europe: { amount: europe, currency: 'EUR' },
  world: { amount: world, currency: 'USD' },
})

/** TVA appliquée sur les prix HT */
export const VAT_RATE = 0.2

export const PRICES = {
  /** Visite d'une galerie : 250 F HT (300 F TTC) en Afrique, 1 € en Europe, 1,5 $ ailleurs */
  visit: zone(250, 1, 1.5),
  /** Ouverture du compte d'hébergement, avec une publication gratuite (HT) */
  signup: zone(10_000, 30, 35),
  /** Renouvellement annuel du droit de publication (HT) */
  renewal: zone(10_000, 30, 35),
  /** Publication d'une œuvre (HT) */
  publication: zone(2_500, 20, 25),
} as const

/**
 * Clip de 30 s sur l'accueil pendant 24 h, même prix pour tous.
 * Montants fixés tels quels par le cahier des charges (3 000 F HT, « soit 3 300 F sur facture »).
 */
export const CLIP_PRICE_XOF = { ht: 3_000, ttc: 3_300 } as const

/** Part des dons reversée à l'artiste */
export const DONATION_ARTIST_SHARE = 0.85

export function withVat(amount: number): number {
  return Math.round(amount * (1 + VAT_RATE) * 100) / 100
}

export function formatPrice({ amount, currency }: Price, locale = 'fr'): string {
  if (currency === 'XOF') return formatXOF(amount, locale)
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
}

/** Prix TTC pour l'Afrique (seule zone où la TVA est précisée), HT ailleurs */
export function displayPrice(prices: Record<Region, Price>, region: Region, locale = 'fr'): string {
  const p = prices[region]
  return formatPrice(region === 'africa' ? { ...p, amount: withVat(p.amount) } : p, locale)
}

function detectRegion(): Region {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
    if (tz.startsWith('Africa/')) return 'africa'
    if (tz.startsWith('Europe/')) return 'europe'
  } catch {
    // fuseau horaire indisponible : zone par défaut
  }
  return 'world'
}

/** Zone tarifaire du visiteur, détectée par son fuseau horaire et modifiable dans le pied de page. */
export const useRegion = create<{ region: Region; setRegion: (region: Region) => void }>((set) => ({
  region: detectRegion(),
  setRegion: (region) => set({ region }),
}))
