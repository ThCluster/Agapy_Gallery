import { ArrowDownRight, ArrowUpRight, Bell, Clock, Eye, Gift, Images, Plus, Wallet } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMyGallery, useSubscription, useWallet } from '@/api/artistSpace'
import { useBalances, useDashboardSummary, usePayouts, useRequestPayout, useRevenue, type Currency, type PayoutChannel } from '@/api/dashboard'
import { ApiError, errorMessage, toNumber } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useAuth } from '@/stores/auth'
import { PaymentReturnNotice } from '../PayMethods'
import { RevenueChart } from '../RevenueChart'
import { formatMoney, rangeFor } from '../revenue'

/** Évolution en % par rapport à la période précédente */
function change(current: number, previous: number): number | null {
  return previous ? Math.round(((current - previous) / previous) * 100) : null
}

export function OverviewPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const name = useAuth((s) => s.user?.artist?.display_name ?? '')
  const summary = useDashboardSummary()
  const gallery = useMyGallery().data
  const walletData = useWallet().data
  const subscription = useSubscription().data

  // Mois en cours face au mois précédent (deux derniers points de la série mensuelle)
  const monthRange = useMemo(() => rangeFor('month', 2), [])
  const monthly = useRevenue({ period: 'month', ...monthRange }).data
  const [prevMonth, curMonth] = useMemo(() => {
    const series = monthly?.series ?? []
    const point = (i: number) => {
      const p = series[i]
      return { visits: p?.visit_count ?? 0, visitRevenue: toNumber(p?.visits), donationRevenue: toNumber(p?.donations) }
    }
    return [point(series.length - 2), point(series.length - 1)]
  }, [monthly])
  const cur = curMonth
  const prev = prevMonth
  const money = (v: number) => formatMoney(v, summary.data?.currency ?? monthly?.currency, lng)
  const formatXOF = (v: number, l?: string) => formatMoney(v, walletData?.currency, l)
  const available = toNumber(summary.data?.available_balance)
  const wallet = { active: !!walletData?.is_active, balance: toNumber(walletData?.balance) }
  const galleryFree = !!gallery?.currently_free
  const galleryFreeUntil = gallery?.free_until ?? ''

  const kpis = [
    { key: 'revenue', icon: Wallet, value: money(cur.visitRevenue + cur.donationRevenue), delta: change(cur.visitRevenue + cur.donationRevenue, prev.visitRevenue + prev.donationRevenue) },
    { key: 'visits', icon: Eye, value: formatNumber(cur.visits, lng), delta: change(cur.visits, prev.visits) },
    { key: 'donations', icon: Gift, value: money(cur.donationRevenue), delta: change(cur.donationRevenue, prev.donationRevenue) },
    { key: 'works', icon: Images, value: summary.data ? String(summary.data.artworks.published) : '—', delta: null },
  ] as const

  const pending = summary.data?.artworks.pending_review ?? 0
  const dateFmt = new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t('dashboard.overview.eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">{t('dashboard.overview.title', { name: name.split(' ')[0] })}</h1>
        </div>
        <Link to="/tableau-de-bord/publier" className="btn-action rounded-full px-5 py-2.5">
          <Plus className="size-4" /> {t('dashboard.nav.publish')}
        </Link>
      </div>

      <PaymentReturnNotice />

      {/* Message trimestriel prévu au cahier des charges (p. 17) */}
      {summary.data && (
      <div className="flex items-start gap-3 rounded-2xl border border-brand-green/15 bg-brand-green/[0.04] p-4 text-sm text-brand-ink dark:text-slate-300">
        <Bell className="mt-0.5 size-4 shrink-0 text-brand-green" />
        <p>{t('dashboard.overview.message', { amount: money(available) })}</p>
      </div>
      )}
      {summary.isError && <p className="text-sm text-rose-700">{t('dashboard.loadError')}</p>}

      {/* Chiffres du mois en cours */}
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ key, icon: Icon, value, delta }) => (
          <li key={key} className="rounded-2xl border border-brand-green/10 bg-white p-5 dark:border-white/10 dark:bg-night-card">
            <p className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Icon className="size-4" /> {t(`dashboard.kpi.${key}`)}
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-brand-graphite tabular-nums dark:text-white">{value}</p>
            {delta !== null && (
              <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {t('dashboard.kpi.vsLastMonth', { delta: `${delta > 0 ? '+' : ''}${delta} %` })}
              </p>
            )}
          </li>
        ))}
      </ul>

      <RevenueChart />

      <PayoutPanel />

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/tableau-de-bord/profil#galerie" className="rounded-2xl border border-brand-green/10 bg-white p-5 transition hover:border-brand-green/30 dark:border-white/10 dark:bg-night-card">
          <p className="text-xs font-medium text-gray-500">{t('dashboard.overview.gallery')}</p>
          <p className="mt-2 font-semibold text-brand-graphite dark:text-white">{galleryFree ? t('artist.freeGallery') : t('artist.paidGallery')}</p>
          <p className="mt-1 text-xs text-gray-500">
            {galleryFree ? (galleryFreeUntil ? t('freeGalleries.until', { date: dateFmt.format(new Date(galleryFreeUntil)) }) : t('freeGalleries.permanent')) : t('dashboard.overview.paidHint')}
          </p>
        </Link>
        <Link to="/tableau-de-bord/oeuvres" className="rounded-2xl border border-brand-green/10 bg-white p-5 transition hover:border-brand-green/30 dark:border-white/10 dark:bg-night-card">
          <p className="text-xs font-medium text-gray-500">{t('dashboard.overview.moderation')}</p>
          <p className="mt-2 flex items-center gap-2 font-semibold text-brand-graphite dark:text-white">
            <Clock className="size-4 text-amber-600" /> {t('dashboard.overview.pending', { count: pending })}
          </p>
          <p className="mt-1 text-xs text-gray-500">{t('dashboard.overview.moderationHint')}</p>
        </Link>
        <Link to="/tableau-de-bord/compte-avoir" className="rounded-2xl border border-brand-green/10 bg-white p-5 transition hover:border-brand-green/30 dark:border-white/10 dark:bg-night-card">
          <p className="text-xs font-medium text-gray-500">{t('dashboard.nav.wallet')}</p>
          <p className="mt-2 font-semibold text-brand-graphite dark:text-white">{formatXOF(wallet.balance, lng)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {wallet.active ? t('dashboard.wallet.active') : t('dashboard.wallet.inactive')} ·{' '}
            {subscription && (subscription.state === 'standby' ? t('dashboard.subscription.states.standby') : t('dashboard.overview.subUntil', { date: dateFmt.format(new Date(subscription.expires_at)) }))}
          </p>
        </Link>
      </div>
    </div>
  )
}

const PAYOUT_STATUS_CLASS = { pending: 'status-pending', paid: 'status-success', rejected: 'status-error' } as const

/** Solde disponible et demandes de retrait (cahier des charges, p. 13) */
function PayoutPanel() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const balances = useBalances()
  const payouts = usePayouts()
  const request = useRequestPayout()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency | ''>('')
  const [channel, setChannel] = useState<PayoutChannel>('momo')
  const [sent, setSent] = useState(false)
  const list = balances.data ?? []
  const selected = list.find((b) => b.currency === currency) ?? list.find((b) => toNumber(b.available) > 0) ?? list[0]
  const available = toNumber(selected?.available)
  const value = Number(amount)
  const dateFmt = new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'short', year: 'numeric' })
  // Retraits suspendus par l'API (paiements encore simulés) : formulaire désactivé
  const disabled = request.error instanceof ApiError && request.error.status === 409 && request.error.code() === 'payouts_disabled'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (disabled || !selected || !(value > 0)) return
    setSent(false)
    request.mutate(
      { amount: value.toFixed(2), currency: selected.currency, channel },
      {
        onSuccess: () => {
          setSent(true)
          setAmount('')
        },
      },
    )
  }

  return (
    <section className="grid gap-6 rounded-3xl border border-brand-green/10 bg-white p-5 sm:p-6 lg:grid-cols-2 dark:border-white/10 dark:bg-night-card">
      <div>
        <h2 className="text-lg font-semibold text-brand-graphite dark:text-white">{t('dashboard.payout.title')}</h2>
        <p className="text-sm text-gray-500">{t('dashboard.payout.subtitle')}</p>
        {balances.isPending ? (
          <p className="mt-4 text-sm text-gray-500">{t('dashboard.loading')}</p>
        ) : balances.isError ? (
          <p className="mt-4 text-sm text-rose-700">{errorMessage(balances.error)}</p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
            <ul className="flex flex-wrap gap-3">
              {list.map((b) => (
                <li key={b.currency}>
                  <button
                    type="button"
                    onClick={() => setCurrency(b.currency)}
                    className={`rounded-2xl border px-4 py-2 text-left transition ${selected?.currency === b.currency ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/10 dark:border-white/10'}`}
                  >
                    <span className="block text-xs text-gray-500">{t('dashboard.payout.available')}</span>
                    <span className="block font-semibold text-brand-graphite tabular-nums dark:text-white">{formatMoney(toNumber(b.available), b.currency, lng)}</span>
                    {toNumber(b.pending_payouts) > 0 && <span className="block text-xs text-amber-700">{t('dashboard.payout.pendingAmount', { amount: formatMoney(toNumber(b.pending_payouts), b.currency, lng) })}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <label className="block">
              <span className="text-sm font-medium text-brand-graphite dark:text-white">{t('dashboard.payout.amount')}</span>
              <input type="number" min={1} max={available || undefined} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="field mt-1" />
            </label>
            <div role="radiogroup" aria-label={t('dashboard.payout.channel')} className="flex flex-wrap gap-2">
              {(['momo', 'iban'] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className={`rounded-full border px-4 py-2 text-sm transition ${channel === c ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/15 hover:border-brand-green/40'}`}>
                  {t(`dashboard.payout.channels.${c}`)}
                </button>
              ))}
            </div>
            </fieldset>
            {disabled ? (
              <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                {t('dashboard.payout.disabled')}
              </p>
            ) : (
              request.isError && <p className="text-sm text-rose-700">{errorMessage(request.error)}</p>
            )}
            {sent && <p className="text-sm text-emerald-700">{t('dashboard.payout.sent')}</p>}
            <button type="submit" disabled={disabled || request.isPending || !selected || !(value > 0) || value > available} className="btn-action rounded-full px-6 py-3">
              {request.isPending ? t('dashboard.payout.sending') : t('dashboard.payout.submit')}
            </button>
          </form>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-brand-graphite dark:text-white">{t('dashboard.payout.history')}</h3>
        {payouts.isPending ? (
          <p className="mt-4 text-sm text-gray-500">{t('dashboard.loading')}</p>
        ) : payouts.isError ? (
          <p className="mt-4 text-sm text-rose-700">{errorMessage(payouts.error)}</p>
        ) : payouts.data.results.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t('dashboard.payout.none')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-graphite/5 dark:divide-white/5">
            {payouts.data.results.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>
                  <span className="block font-semibold text-brand-graphite tabular-nums dark:text-white">{formatMoney(toNumber(p.amount), p.currency, lng)}</span>
                  <span className="block text-xs text-gray-500">
                    {dateFmt.format(new Date(p.created_at))} · {t(`dashboard.payout.channels.${p.channel}`)}
                    {p.note ? ` · ${p.note}` : ''}
                  </span>
                </span>
                <span className={PAYOUT_STATUS_CLASS[p.status]}>{t(`dashboard.payout.status.${p.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
