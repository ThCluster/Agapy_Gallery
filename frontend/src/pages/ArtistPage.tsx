import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Bot, CheckCircle2, Search, ShieldCheck, TrainFront, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { checkVisitAccess, sendDonation, takePendingDonation, useArtist, useArtists } from '@/api/catalog'
import { getPayment, getVisitToken, saveVisitToken } from '@/api/payments'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import { ArtistHero } from '@/features/artist/ArtistHero'
import { ArtworkGrid } from '@/features/artist/ArtworkGrid'
import { ArtworkLightbox } from '@/features/artist/ArtworkLightbox'
import { EntranceWall } from '@/features/artist/EntranceWall'
import { SupportCard } from '@/features/artist/SupportCard'
import { hallPhotos } from '@/features/artist/villaPhotos'
import { ApiError, errorMessage } from '@/lib/api'
import { displayPrice, PRICES, useRegion } from '@/lib/pricing'

const SECTIONS = ['works', 'villa', 'about'] as const

type Notice = { tone: 'success' | 'error'; text: string }

/**
 * Retour de la page de paiement (?payment=<réf>&status=<statut>) : enregistre le jeton de visite,
 * enchaîne le don éventuellement choisi en même temps, affiche un message.
 */
function usePaymentReturn(slug: string, setNotice: (n: Notice | null) => void) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const ref = params.get('payment')
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!ref || !slug || handled.current === ref) return
    handled.current = ref
    const clear = () =>
      setParams(
        (p) => {
          p.delete('payment')
          p.delete('status')
          return p
        },
        { replace: true },
      )
    getPayment(ref)
      .then(async (pay) => {
        if (pay.status !== 'succeeded') {
          takePendingDonation(slug)
          setNotice({ tone: 'error', text: t('catalog.payment.failed') })
          return
        }
        if (pay.purpose === 'donation') {
          setNotice({ tone: 'success', text: t('catalog.payment.donationThanks') })
          return
        }
        if (pay.visit?.token) saveVisitToken(slug, pay.visit.token, pay.visit.expires_at)
        await queryClient.invalidateQueries({ queryKey: ['visit-access', slug] })
        setNotice({ tone: 'success', text: t('catalog.payment.visitThanks') })
        // Don choisi en même temps que la visite : second paiement
        const pending = takePendingDonation(slug)
        if (pending && (await sendDonation(pending))) setNotice({ tone: 'success', text: t('catalog.payment.donationThanks') })
      })
      .catch((e) => setNotice({ tone: 'error', text: errorMessage(e) }))
      .finally(clear)
  }, [ref, slug, setParams, setNotice, queryClient, t])
}

export function ArtistPage() {
  const { artistId = '' } = useParams()
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const [notice, setNotice] = useState<Notice | null>(null)
  const { data: artist, isPending, error } = useArtist(artistId)
  const { data: list } = useArtists({ page_size: 12 })
  // Droit de visite d'une galerie payante : jeton de visite encore valide
  const access = useQuery({
    queryKey: ['visit-access', artistId],
    queryFn: () => checkVisitAccess(artistId, getVisitToken(artistId)),
    enabled: !!artist && !artist.free,
    staleTime: 60_000,
    retry: false,
  })
  usePaymentReturn(artistId, setNotice)

  if (isPending) {
    return (
      <div className="mx-auto max-w-7xl animate-pulse px-4 pt-6 sm:px-6" aria-busy>
        <div className="h-[260px] rounded-3xl bg-brand-mist sm:h-[420px] dark:bg-night-card" />
        <div className="relative mx-auto -mt-20 h-40 max-w-6xl rounded-3xl bg-white/80 dark:bg-night-field" />
      </div>
    )
  }

  if (error && !(error instanceof ApiError && error.status === 404)) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-28 text-center">
        <p className="text-gray-500">{errorMessage(error)}</p>
      </section>
    )
  }

  // Message prévu au cahier des charges quand l'artiste n'existe pas
  if (!artist) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-28 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-mist text-brand-green">
          <Search className="size-7" />
        </span>
        <h1 className="mt-6 text-3xl font-light">{t('artist.notFound.title')}</h1>
        <p className="mt-3 text-gray-500">{t('artist.notFound.text')}</p>
        <Link to="/artistes" className="btn-primary mt-8 rounded-full px-6 py-3">
          {t('artist.notFound.cta')}
        </Link>
      </section>
    )
  }

  const works = artist.artworks
  const halls = hallPhotos(artist.address)
  const hasAccess = artist.free || !!access.data?.access
  const others = (list?.results ?? []).filter((a) => a.id !== artist.id && a.cover).slice(0, 4)
  const visitLabel = artist.free ? t('artwork.free') : displayPrice(PRICES.visit, region, i18n.resolvedLanguage)

  return (
    <div className="pb-28 lg:pb-0">
      <ArtistHero artist={artist} />

      {notice && (
        <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
          <p
            role="status"
            className={`flex items-start gap-3 rounded-2xl p-4 text-sm ${
              notice.tone === 'success' ? 'bg-brand-green/10 text-brand-green dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
            }`}
          >
            {notice.tone === 'success' ? <CheckCircle2 className="size-5 shrink-0" /> : <XCircle className="size-5 shrink-0" />}
            <span className="flex-1">{notice.text}</span>
            {notice.tone === 'success' && hasAccess && (
              <Link to={`/ville/${artist.id}`} className="link shrink-0 font-semibold">
                {t('catalog.payment.enter')} →
              </Link>
            )}
          </p>
        </div>
      )}

      {/* Navigation interne, collée sous l'en-tête */}
      <nav aria-label={t('artist.sectionsNav')} className="sticky top-20 z-30 mt-8 border-y border-brand-green/10 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-night-bg/85">
        <ul className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {SECTIONS.map((s) => (
            <li key={s}>
              <a href={`#${s}`} className="block border-b-2 border-transparent px-3 py-3.5 text-sm whitespace-nowrap text-brand-ink hover:border-brand-green hover:text-brand-green dark:text-slate-300">
                {t(`artist.sections.${s}`)}
              </a>
            </li>
          ))}
          <li className="lg:hidden">
            <a href="#support" className="block border-b-2 border-transparent px-3 py-3.5 text-sm font-semibold whitespace-nowrap text-brand-orange">
              {t('artist.sections.support')}
            </a>
          </li>
        </ul>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-20">
          <Reveal>
            <EntranceWall artist={artist} work={works[0]} onOpen={() => setOpen(0)} />
          </Reveal>

          {/* Œuvres */}
          <section id="works" className="scroll-mt-40">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{t('artist.worksEyebrow')}</p>
                <h2 className="mt-2 text-3xl font-light tracking-tight">{t('artist.worksTitle', { count: works.length })}</h2>
              </div>
            </div>
            <ArtworkGrid works={works} onOpen={setOpen} />
          </section>

          {/* La villa */}
          <section id="villa" className="scroll-mt-40">
            <p className="eyebrow">{t('artist.villa.eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-light tracking-tight">{t('artist.villa.title')}</h2>
            <p className="mt-3 max-w-2xl text-gray-500">{t('artist.villa.text', { name: artist.name })}</p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {halls.map((hall, i) => (
                <div key={hall} className={`relative overflow-hidden rounded-2xl bg-brand-mist ${i === 0 ? 'col-span-2 aspect-[16/10] sm:col-span-2 sm:row-span-2 sm:aspect-auto' : 'aspect-square'}`}>
                  <Img photo={hall} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-graphite">
                    {t('artist.villa.hall', { n: i + 1 })}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-brand-mist p-5 sm:flex-row sm:items-center dark:bg-night-card">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-brand-green dark:bg-night-field">
                <Bot className="size-6" />
              </span>
              <p className="flex-1 text-sm text-brand-ink dark:text-slate-300">{t('artist.villa.guide', { name: artist.name })}</p>
              <Link to={`/ville/${artist.id}`} className="btn-action shrink-0 rounded-full px-5 py-2.5">
                <TrainFront className="size-4" /> {t('artist.villa.cta')}
              </Link>
            </div>
          </section>

          {/* À propos */}
          <section id="about" className="scroll-mt-40">
            <p className="eyebrow">{t('artist.about.eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-light tracking-tight">{t('artist.about.title', { name: artist.name })}</h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-brand-ink dark:text-slate-300">
              {artist.bio || t('catalog.artist.defaultBio', { name: artist.name, city: artist.city, country: artist.country })}
            </p>
            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                [t('artist.about.discipline'), artist.discipline ? t(`discipline.${artist.discipline}`) : '—'],
                [t('artist.about.location'), `${artist.city}, ${artist.country}`],
                [t('artist.about.since'), String(artist.member_since)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-brand-graphite/10 p-4 dark:border-white/10">
                  <dt className="text-xs text-gray-500">{k}</dt>
                  <dd className="mt-1 font-semibold text-brand-graphite dark:text-white">{v}</dd>
                </div>
              ))}
            </dl>
            {artist.copyright_office && (
              <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <ShieldCheck className="size-4 text-brand-green" /> {t('artist.protectedBy', { office: artist.copyright_office })}
              </p>
            )}
          </section>
        </div>

        {/* Soutenir l'artiste : colonne collante sur ordinateur */}
        <aside id="support" className="scroll-mt-40">
          <div className="lg:sticky lg:top-40">
            <SupportCard
              artist={artist}
              hasAccess={hasAccess}
              onPaid={(purpose) => {
                if (purpose === 'visit') void access.refetch()
                setNotice({ tone: 'success', text: t(purpose === 'visit' ? 'catalog.payment.visitThanks' : 'catalog.payment.donationThanks') })
              }}
            />
          </div>
        </aside>
      </div>

      {/* Autres artistes */}
      {others.length > 0 && (
        <section className="bg-brand-mist py-20 dark:bg-night-card">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="eyebrow">{t('artist.more.eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-light tracking-tight">{t('artist.more.title')}</h2>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {others.map((a) => (
                <Link key={a.id} to={`/artistes/${a.id}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                  <Img src={a.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
                    <span>
                      <span className="block font-semibold">{a.name}</span>
                      <span className="block text-xs text-white/80">{a.city}</span>
                    </span>
                    <ArrowUpRight className="size-5 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Barre d'actions mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-green/10 bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden dark:bg-night-bg/95">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-graphite dark:text-white">{artist.name}</p>
            <p className="text-xs text-gray-500">
              {t('artist.support.visit')} · <span className="price">{visitLabel}</span>
            </p>
          </div>
          <a href="#support" className="btn-primary rounded-full px-5 py-3">
            {t('artist.sections.support')}
          </a>
        </div>
      </div>

      {open !== null && works.length > 0 && <ArtworkLightbox works={works} index={open} artist={artist} onChange={setOpen} onClose={close} />}
    </div>
  )
}
