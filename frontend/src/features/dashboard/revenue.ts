/**
 * Revenus de l'artiste (part nette qui lui revient), regroupés par l'API
 * (GET /dashboards/me/revenue/?period=) : outils de période, libellés et montants.
 */
import { formatNumber, formatXOF } from '@/lib/format'

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year'
export const PERIODS: Period[] = ['day', 'week', 'month', 'quarter', 'year']

/** Nombre de barres affichées par période */
export const BUCKET_COUNT: Record<Period, number> = { day: 30, week: 12, month: 12, quarter: 8, year: 3 }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function startOf(period: Period, d: Date): Date {
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

/** Intervalle des N dernières périodes (dates ISO, bornes incluses) */
export function rangeFor(period: Period, count = BUCKET_COUNT[period], today = new Date()): { from: string; to: string } {
  const s = startOf(period, today)
  const n = count - 1
  const from =
    period === 'day'
      ? new Date(s.getFullYear(), s.getMonth(), s.getDate() - n)
      : period === 'week'
        ? new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7 * n)
        : period === 'month'
          ? new Date(s.getFullYear(), s.getMonth() - n, 1)
          : period === 'quarter'
            ? new Date(s.getFullYear(), s.getMonth() - 3 * n, 1)
            : new Date(s.getFullYear() - n, 0, 1)
  return { from: iso(from), to: iso(today) }
}

/** Début de période renvoyé par l'API (« 2026-05-01 » ou date-heure) en date locale */
export function parseStart(start: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(start)
}

/** Libellé court d'une période pour l'axe */
export function bucketLabel(d: Date, period: Period, locale: string): string {
  switch (period) {
    case 'day':
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

/** Montant dans sa devise (F CFA par défaut) */
export function formatMoney(amount: number, currency: string | undefined, locale = 'fr'): string {
  if (!currency || currency === 'XOF') return formatXOF(Math.round(amount), locale)
  return `${formatNumber(Math.round(amount * 100) / 100, locale)} ${currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency}`
}
