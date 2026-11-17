/**
 * Revenus d'exemple de l'artiste (part nette qui lui revient), jour par jour sur trois ans.
 * À remplacer par l'API. Visite : 75 % de 250 F = 187,5 F ; don : 85 % du montant.
 */
export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year'
export const PERIODS: Period[] = ['day', 'week', 'month', 'quarter', 'year']

export interface DayRevenue {
  date: Date
  visits: number
  /** Revenus nets des visites (F CFA) */
  visitRevenue: number
  /** Revenus nets des dons (F CFA) */
  donationRevenue: number
}

export interface Bucket {
  key: string
  start: Date
  visits: number
  visitRevenue: number
  donationRevenue: number
}

const VISIT_SHARE = 250 * 0.75
const DONATION_SHARE = 0.85

function random(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** Série quotidienne déterministe : croissance lente, rythme hebdomadaire, quelques gros dons */
export function dailyRevenue(today = new Date()): DayRevenue[] {
  const r = random(2024)
  const days: DayRevenue[] = []
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  for (let i = 3 * 365 - 1; i >= 0; i--) {
    const date = new Date(start.getTime() - i * 86_400_000)
    const growth = 0.35 + (1 - i / (3 * 365)) * 0.9
    const weekend = date.getDay() === 0 || date.getDay() === 6 ? 1.45 : 1
    const visits = Math.round((8 + r() * 22) * growth * weekend)
    const donations = r() < 0.18 ? Math.round((500 + r() * (r() < 0.1 ? 9500 : 2500)) / 100) * 100 : 0
    days.push({ date, visits, visitRevenue: Math.round(visits * VISIT_SHARE), donationRevenue: Math.round(donations * DONATION_SHARE) })
  }
  return days
}

function startOf(period: Period, d: Date): Date {
  switch (period) {
    case 'day':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    case 'week': {
      const day = (d.getDay() + 6) % 7 // lundi = 0
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
    }
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1)
    case 'quarter':
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
    case 'year':
      return new Date(d.getFullYear(), 0, 1)
  }
}

/** Nombre de barres affichées par période */
export const BUCKET_COUNT: Record<Period, number> = { day: 30, week: 12, month: 12, quarter: 8, year: 3 }

/** Regroupe la série quotidienne par jour, semaine, mois, trimestre ou année (les N dernières périodes) */
export function aggregate(days: DayRevenue[], period: Period): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const d of days) {
    const start = startOf(period, d.date)
    const key = start.toISOString()
    const b = map.get(key) ?? { key, start, visits: 0, visitRevenue: 0, donationRevenue: 0 }
    b.visits += d.visits
    b.visitRevenue += d.visitRevenue
    b.donationRevenue += d.donationRevenue
    map.set(key, b)
  }
  return [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime()).slice(-BUCKET_COUNT[period])
}

/** Libellé court d'une période pour l'axe */
export function bucketLabel(b: Bucket, period: Period, locale: string): string {
  const d = b.start
  switch (period) {
    case 'day':
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d)
    case 'week':
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d)
    case 'month':
      return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(d)
    case 'quarter':
      return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
    case 'year':
      return String(d.getFullYear())
  }
}
