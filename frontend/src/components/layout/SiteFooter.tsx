import { ArrowUp, Loader2, Smartphone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { siteLang, subscribeNewsletter } from '@/api/site'
import { Logo } from '@/components/ui/Logo'
import { errorMessage } from '@/lib/api'
import { type Region, useRegion } from '@/lib/pricing'

const YEAR = new Date().getFullYear()
const PAYMENTS = ['Orange Money', 'MTN MoMo', 'Wave', 'Moov Money', 'Visa', 'Mastercard']

export function SiteFooter() {
  const { t, i18n } = useTranslation()
  const [subscribed, setSubscribed] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { region, setRegion } = useRegion()

  const columns = [
    {
      title: t('footer.colAgapy'),
      links: [
        { label: t('footer.about'), to: '/qui-sommes-nous' },
        { label: t('footer.partners'), to: '/partenaires' },
        { label: t('footer.forum'), to: '/forum' },
        { label: t('footer.contact'), to: '/contact' },
      ],
    },
    {
      title: t('footer.colVisitors'),
      links: [
        { label: t('nav.visit'), to: '/ville' },
        { label: t('nav.search'), to: '/recherche' },
        { label: t('header.categories_.freeGalleries'), to: '/galeries-gratuites' },
      ],
    },
    {
      title: t('footer.colArtists'),
      links: [
        { label: t('nav.register'), to: '/inscription' },
        { label: t('footer.publish'), to: '/tableau-de-bord' },
        { label: t('footer.dashboard'), to: '/tableau-de-bord' },
        { label: t('footer.advertise'), to: '/publicite' },
      ],
    },
    {
      title: t('footer.colLegal'),
      links: [
        { label: t('footer.terms'), to: '/conditions-generales' },
        { label: t('footer.legal'), to: '/infos-legales' },
      ],
    },
  ]

  const onSubscribe = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await subscribeNewsletter(email.trim(), siteLang(i18n.resolvedLanguage))
      setSubscribed(true)
    } catch (err) {
      setError(errorMessage(err, 'email'))
    } finally {
      setSending(false)
    }
  }

  return (
    <footer className="banner-green relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pt-12">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="mb-3 text-sm font-bold">{col.title}</p>
                <ul className="space-y-2 text-sm text-white/75">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <form onSubmit={onSubscribe} className="rounded-xl bg-white/10 p-5">
              <p className="font-bold">{t('footer.newsletterTitle')}</p>
              <p className="mt-1 text-sm text-white/75">{t('footer.newsletterText')}</p>
              {subscribed ? (
                <p className="mt-3 text-sm font-semibold text-brand-yellow">{t('footer.newsletterThanks')}</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!error}
                    placeholder={t('footer.emailPlaceholder')}
                    aria-label={t('footer.emailPlaceholder')}
                    className="min-w-0 flex-1 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:border-brand-orange focus:outline-none"
                  />
                  <button type="submit" disabled={sending} className="btn-action">
                    {sending ? <Loader2 className="size-4 animate-spin" aria-label={t('content.loading')} /> : 'OK'}
                  </button>
                </div>
              )}
              {error && !subscribed && (
                <p role="alert" className="mt-2 text-xs text-brand-yellow">
                  {error}
                </p>
              )}
            </form>
            {/* Applications mobiles : pas encore publiées sur les magasins d'applications */}
            <div>
              <p className="mb-2 text-sm font-bold">{t('footer.mobileApps')}</p>
              <p className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-sm text-white/80 ring-1 ring-white/15" aria-disabled="true">
                <Smartphone className="size-5 shrink-0" /> {t('footer.mobileSoon')}
              </p>
            </div>
            {/* Zone tarifaire : prix en F CFA, en € ou en $ */}
            <label className="block">
              <span className="mb-2 block text-sm font-bold">{t('footer.region')}</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as Region)}
                className="w-full max-w-xs rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white focus:border-brand-orange focus:outline-none [&>option]:text-brand-graphite"
              >
                {(['africa', 'europe', 'world'] as const).map((r) => (
                  <option key={r} value={r}>
                    {t(`footer.regions.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-2 text-sm font-bold">{t('footer.payments')}</p>
              <ul className="flex flex-wrap gap-2">
                {PAYMENTS.map((p) => (
                  <li key={p} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-brand-graphite">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 py-5 text-xs text-white/70">
          <Logo variant="white" className="h-8" />
          <p>© {YEAR} AGAPY-GALLERY · {t('footer.rights')}</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={t('footer.backToTop')}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>

      {/* Grand logo décoratif en bas de page */}
      <p aria-hidden className="pointer-events-none -mb-[0.22em] text-center font-logo text-[22vw] leading-none font-black tracking-tighter text-white/10 select-none">
        Agapy
      </p>
    </footer>
  )
}
