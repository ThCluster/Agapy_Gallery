import { ArrowDownRight, ArrowUpRight, Bell, Clock, Eye, Gift, Images, Plus, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatNumber, formatXOF } from '@/lib/format'
import { getArtist } from '@/mocks/artistProfiles'
import { subscriptionState, useArtistSpace } from '@/stores/artistSpace'
import { useAuth } from '@/stores/auth'
import { RevenueChart } from '../RevenueChart'
import { aggregate, dailyRevenue } from '../revenue'

/** Évolution en % par rapport à la période précédente */
function change(current: number, previous: number): number | null {
  return previous ? Math.round(((current - previous) / previous) * 100) : null
}

export function OverviewPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const artistId = useAuth((s) => s.artistId)!
  const { works, wallet, galleryFree, galleryFreeUntil, expiresAt } = useArtistSpace()
  const artist = getArtist(artistId)!.artist

  const days = useMemo(() => dailyRevenue(), [])
  const cur = useMemo(() => aggregate(days, 'month').slice(-1)[0], [days])
  // Comparaison juste : le mois en cours (du 1er à aujourd'hui) face aux mêmes jours du mois précédent
  const prev = useMemo(() => {
    const last = days[days.length - 1].date
    const from = new Date(last.getFullYear(), last.getMonth() - 1, 1)
    const to = new Date(last.getFullYear(), last.getMonth() - 1, last.getDate())
    return days
      .filter((d) => d.date >= from && d.date <= to)
      .reduce((acc, d) => ({ visits: acc.visits + d.visits, visitRevenue: acc.visitRevenue + d.visitRevenue, donationRevenue: acc.donationRevenue + d.donationRevenue }), { visits: 0, visitRevenue: 0, donationRevenue: 0 })
  }, [days])
  // Disponible au versement : revenus du mois en cours (exemple)
  const available = cur.visitRevenue + cur.donationRevenue

  const kpis = [
    { key: 'revenue', icon: Wallet, value: formatXOF(cur.visitRevenue + cur.donationRevenue, lng), delta: change(cur.visitRevenue + cur.donationRevenue, prev.visitRevenue + prev.donationRevenue) },
    { key: 'visits', icon: Eye, value: formatNumber(cur.visits, lng), delta: change(cur.visits, prev.visits) },
    { key: 'donations', icon: Gift, value: formatXOF(cur.donationRevenue, lng), delta: change(cur.donationRevenue, prev.donationRevenue) },
    { key: 'works', icon: Images, value: String(works.filter((w) => w.status === 'published').length), delta: null },
  ] as const

  const pending = works.filter((w) => w.status === 'pending').length
  const sub = subscriptionState(expiresAt)
  const dateFmt = new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t('dashboard.overview.eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">{t('dashboard.overview.title', { name: artist.name.split(' ')[0] })}</h1>
        </div>
        <Link to="/tableau-de-bord/publier" className="btn-action rounded-full px-5 py-2.5">
          <Plus className="size-4" /> {t('dashboard.nav.publish')}
        </Link>
      </div>

      {/* Message trimestriel prévu au cahier des charges (p. 17) */}
      <div className="flex items-start gap-3 rounded-2xl border border-brand-green/15 bg-brand-green/[0.04] p-4 text-sm text-brand-ink dark:text-slate-300">
        <Bell className="mt-0.5 size-4 shrink-0 text-brand-green" />
        <p>{t('dashboard.overview.message', { amount: formatXOF(available, lng) })}</p>
      </div>

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

      <RevenueChart days={days} />

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
            {sub.state === 'standby' ? t('dashboard.subscription.states.standby') : t('dashboard.overview.subUntil', { date: dateFmt.format(new Date(expiresAt)) })}
          </p>
        </Link>
      </div>
    </div>
  )
}
