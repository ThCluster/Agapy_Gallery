import { AlertTriangle, BarChart3, ExternalLink, Images, Loader2, LogOut, Plus, RefreshCw, User, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Logo } from '@/components/ui/Logo'
import { useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@/api/artistSpace'
import { useAuth } from '@/stores/auth'

const NAV = [
  { to: '/tableau-de-bord', key: 'overview', icon: BarChart3, end: true },
  { to: '/tableau-de-bord/oeuvres', key: 'works', icon: Images },
  { to: '/tableau-de-bord/publier', key: 'publish', icon: Plus },
  { to: '/tableau-de-bord/compte-avoir', key: 'wallet', icon: Wallet },
  { to: '/tableau-de-bord/abonnement', key: 'subscription', icon: RefreshCw },
  { to: '/tableau-de-bord/profil', key: 'profile', icon: User },
] as const

/** Espace artiste : réservé aux artistes connectés, sans la navigation publique. */
export function DashboardLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const artist = user?.artist ?? null
  const active = artist?.status === 'active' || artist?.status === 'dormant'

  const signOut = async () => {
    await logout().catch(() => undefined)
    queryClient.clear()
    navigate('/')
  }

  // Session en cours de vérification (rafraîchissement au chargement)
  if (status === 'unknown')
    return (
      <div className="grid min-h-dvh place-items-center bg-[#fafaf8] dark:bg-night-bg">
        <Loader2 className="size-8 animate-spin text-brand-green" aria-label={t('auth.dashboard.loading')} />
      </div>
    )

  // Pas connecté : retour à la connexion, puis ici après
  if (status === 'anonymous' || !user) return <Navigate to={`/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`} replace />

  // Compte sans profil artiste, en attente du paiement d'ouverture ou exclu
  if (!artist || !active) {
    const reason = !artist ? 'notArtist' : artist.status === 'excluded' ? 'excluded' : 'pending'
    return (
      <div className="grid min-h-dvh place-items-center bg-[#fafaf8] px-4 dark:bg-night-bg">
        <div className="max-w-md rounded-3xl border border-brand-green/10 bg-white p-8 text-center dark:border-white/10 dark:bg-night-card">
          <AlertTriangle className="mx-auto size-8 text-brand-orange" />
          <h1 className="mt-4 text-2xl font-light tracking-tight">{t(`auth.dashboard.${reason}.title`)}</h1>
          <p className="mt-2 text-sm text-gray-500">{t(`auth.dashboard.${reason}.text`)}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {reason === 'pending' && (
              <Link to="/inscription" className="btn-primary rounded-full px-5 py-2.5">
                {t('auth.dashboard.pending.action')}
              </Link>
            )}
            <button type="button" onClick={signOut} className="btn-secondary rounded-full px-5 py-2.5">
              <LogOut className="size-4" /> {t('dashboard.logout')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const photo = typeof artist.photo === 'string' && artist.photo ? artist.photo : undefined
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition ${
      isActive ? 'bg-brand-green text-white shadow-sm' : 'text-brand-ink hover:bg-brand-mist dark:text-slate-300 dark:hover:bg-night-card'
    }`

  return (
    <div className="min-h-dvh bg-[#fafaf8] dark:bg-night-bg">
      {/* Barre du haut */}
      <header className="sticky top-0 z-40 border-b border-brand-green/10 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-night-bg/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" aria-label={t('header.home')}>
            <Logo className="h-7" />
          </Link>
          <span className="hidden rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-green sm:inline dark:bg-night-card">{t('dashboard.space')}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to={`/artistes/${artist.id}`} className="btn-secondary hidden rounded-full px-4 py-2 text-sm sm:inline-flex">
              <ExternalLink className="size-4" /> {t('dashboard.viewVilla')}
            </Link>
            <span className="flex items-center gap-2">
              <span className="block size-9 overflow-hidden rounded-full bg-brand-mist">
                <Img src={photo} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="hidden text-sm font-medium text-brand-graphite md:inline dark:text-white">{artist.display_name}</span>
            </span>
            <button
              type="button"
              onClick={signOut}
              className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-brand-mist hover:text-rose-600 dark:hover:bg-night-card"
              aria-label={t('dashboard.logout')}
              title={t('dashboard.logout')}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_1fr] lg:py-10">
        {/* Navigation de l'espace : colonne sur ordinateur, bandeau défilant sur mobile */}
        <nav aria-label={t('dashboard.navLabel')} className="lg:sticky lg:top-24 lg:self-start">
          <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {NAV.map(({ to, key, icon: Icon, ...rest }) => (
              <li key={key}>
                <NavLink to={to} end={'end' in rest} className={link}>
                  <Icon className="size-4 shrink-0" /> {t(`dashboard.nav.${key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0">
          <SubscriptionBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Rappel de l'abonnement annuel (mise en veille automatique à la date anniversaire) */
function SubscriptionBanner() {
  const { t } = useTranslation()
  const location = useLocation()
  const sub = useSubscription().data
  if (!sub || sub.state === 'active' || location.pathname.endsWith('/abonnement')) return null
  return (
    <div
      role="status"
      className={`mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${
        sub.state === 'standby' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <AlertTriangle className="size-5 shrink-0" />
      <p className="flex-1 text-sm">{sub.state === 'standby' ? t('dashboard.banner.standby') : t('dashboard.banner.soon', { count: sub.days_left })}</p>
      <Link to="/tableau-de-bord/abonnement" className="btn-action shrink-0 rounded-full px-4 py-2 text-sm">
        {t('dashboard.banner.renew')}
      </Link>
    </div>
  )
}
