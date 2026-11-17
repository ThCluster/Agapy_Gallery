import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber, formatXOF } from '@/lib/format'
import { aggregate, bucketLabel, PERIODS, type Bucket, type DayRevenue, type Period } from './revenue'

/**
 * Couleurs des séries, voisines de la charte mais validées pour les graphiques
 * (contraste ≥ 3:1 sur fond blanc, séparation daltonisme ΔE 10,4).
 */
const SERIES = { visits: '#079669', donations: '#D2570B' } as const

interface Row {
  label: string
  visits: number
  visitRevenue: number
  donationRevenue: number
  total: number
}

function ChartTooltip({ active, row, lng }: { active?: boolean; row?: Row; lng: string }) {
  const { t } = useTranslation()
  if (!active || !row) return null
  return (
    <div className="rounded-xl border border-brand-graphite/10 bg-white px-4 py-3 text-sm shadow-lg dark:border-white/10 dark:bg-night-card">
      <p className="font-semibold text-brand-graphite dark:text-white">{row.label}</p>
      <p className="mt-2 flex items-center gap-2 text-brand-ink dark:text-slate-300">
        <span className="size-2.5 rounded-sm" style={{ background: SERIES.visits }} /> {t('dashboard.chart.visits')} : {formatXOF(row.visitRevenue, lng)}
        <span className="text-gray-400">({formatNumber(row.visits, lng)})</span>
      </p>
      <p className="mt-1 flex items-center gap-2 text-brand-ink dark:text-slate-300">
        <span className="size-2.5 rounded-sm" style={{ background: SERIES.donations }} /> {t('dashboard.chart.donations')} : {formatXOF(row.donationRevenue, lng)}
      </p>
      <p className="mt-2 border-t border-brand-graphite/10 pt-2 font-semibold text-brand-graphite dark:border-white/10 dark:text-white">
        {t('dashboard.chart.total')} : {formatXOF(row.total, lng)}
      </p>
    </div>
  )
}

/** Revenus de l'artiste par jour, semaine, mois, trimestre ou année (cahier des charges, p. 13). */
export function RevenueChart({ days }: { days: DayRevenue[] }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const [period, setPeriod] = useState<Period>('month')
  const [showTable, setShowTable] = useState(false)

  const rows: Row[] = useMemo(
    () =>
      aggregate(days, period).map((b: Bucket) => ({
        label: bucketLabel(b, period, lng),
        visits: b.visits,
        visitRevenue: b.visitRevenue,
        donationRevenue: b.donationRevenue,
        total: b.visitRevenue + b.donationRevenue,
      })),
    [days, period, lng],
  )
  const compact = new Intl.NumberFormat(lng, { notation: 'compact', maximumFractionDigits: 1 })

  return (
    <section className="rounded-3xl border border-brand-green/10 bg-white p-5 sm:p-6 dark:border-white/10 dark:bg-night-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-graphite dark:text-white">{t('dashboard.chart.title')}</h2>
          <p className="text-sm text-gray-500">{t('dashboard.chart.subtitle')}</p>
        </div>
        {/* Filtres sur une seule ligne, au-dessus du graphique */}
        <div role="tablist" aria-label={t('dashboard.chart.periodLabel')} className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-brand-mist p-1 dark:bg-night-field">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:text-sm ${
                period === p ? 'bg-white text-brand-green shadow-sm dark:bg-night-card dark:text-emerald-400' : 'text-gray-500 hover:text-brand-graphite dark:hover:text-white'
              }`}
            >
              {t(`dashboard.chart.periods.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Légende (deux séries) */}
      <ul className="mt-5 flex flex-wrap gap-5 text-sm text-brand-ink dark:text-slate-300">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ background: SERIES.visits }} /> {t('dashboard.chart.visits')}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ background: SERIES.donations }} /> {t('dashboard.chart.donations')}
        </li>
      </ul>

      {showTable ? (
        <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-brand-graphite/10 dark:border-white/10">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('dashboard.chart.title')}</caption>
            <thead className="sticky top-0 bg-brand-mist text-left text-xs text-gray-500 dark:bg-night-field">
              <tr>
                <th className="px-3 py-2 font-medium">{t('dashboard.chart.period')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('dashboard.chart.visitCount')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('dashboard.chart.visits')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('dashboard.chart.donations')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('dashboard.chart.total')}</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.label} className="border-t border-brand-graphite/5 dark:border-white/5">
                  <td className="px-3 py-2 text-brand-graphite dark:text-white">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.visits, lng)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatXOF(r.visitRevenue, lng)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatXOF(r.donationRevenue, lng)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatXOF(r.total, lng)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#E8ECEA" strokeWidth={1} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#D5DBD8' }} tick={{ fill: '#6b7280', fontSize: 12 }} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v: number) => compact.format(v)} />
              <Tooltip cursor={{ fill: 'rgb(0 103 79 / 0.06)' }} content={(props) => <ChartTooltip active={props.active} row={props.payload?.[0]?.payload as Row | undefined} lng={lng} />} />
              {/* Barres empilées : fines, séparées par un liseré de la couleur du fond, sommet arrondi */}
              <Bar dataKey="visitRevenue" stackId="rev" fill={SERIES.visits} stroke="#ffffff" strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
              <Bar dataKey="donationRevenue" stackId="rev" fill={SERIES.donations} stroke="#ffffff" strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <button type="button" onClick={() => setShowTable((s) => !s)} className="link mt-4 text-sm">
        {showTable ? t('dashboard.chart.showChart') : t('dashboard.chart.showTable')}
      </button>
    </section>
  )
}
