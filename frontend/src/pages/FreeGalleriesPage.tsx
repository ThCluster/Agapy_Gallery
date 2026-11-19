import { ArrowRight, CalendarClock, Gift, MapPin, Search, Sparkles, TrainFront } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useFreeGalleryWorks, type CatalogArtist, type CatalogArtwork } from '@/api/catalog'
import { ArtworkCard, ArtworkCardSkeleton } from '@/components/ui/ArtworkCard'
import { Img } from '@/components/ui/Img'
import { villaPhoto } from '@/features/artist/villaPhotos'
import { normalize } from '@/lib/search'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const FILTERS = ['all', 'peinture', 'photographie', 'sculpture'] as const
type Filter = (typeof FILTERS)[number]

/** Galeries en visite gratuite (cahier des charges, p. 9-10) : la gratuité peut être limitée dans le temps. */
export function FreeGalleriesPage() {
  const { t, i18n } = useTranslation()
  useDocumentTitle(`${t('freeGalleries.titleStart')} ${t('freeGalleries.titleEnd')}`)
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState(params.get('q') ?? '')

  // Galeries gratuites aujourd'hui (/catalog/free-galleries/) et leurs œuvres
  const { data: freeWorks, galleries: all, isPending } = useFreeGalleryWorks()
  const galleries = useMemo(() => {
    const q = normalize(query)
    return (all ?? []).filter(
      (a) => (filter === 'all' || a.discipline === filter) && (!q || [a.name, a.city, a.country].some((v) => normalize(v).includes(q))),
    )
  }, [all, filter, query])
  const worksOf = (id: string) => (freeWorks ?? []).filter((w) => w.artist_id === id)

  const totalFree = all?.length ?? 0
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      {/* En-tête */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_70%_0%,rgb(255_255_255/0.9),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow">{t('freeGalleries.eyebrow')}</p>
            <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight sm:text-6xl">
              {t('freeGalleries.titleStart')} <span className="font-semibold text-brand-green dark:text-emerald-400">{t('freeGalleries.titleEnd')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-500">{t('freeGalleries.subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <p>
                <span className="block text-3xl font-semibold text-brand-graphite dark:text-white">{totalFree}</span>
                <span className="text-gray-500">{t('freeGalleries.statGalleries')}</span>
              </p>
              <p>
                <span className="block text-3xl font-semibold text-brand-graphite dark:text-white">0 F</span>
                <span className="text-gray-500">{t('freeGalleries.statPrice')}</span>
              </p>
            </div>
          </div>
          {/* Trois œuvres accrochées en quinconce */}
          <div className="relative hidden h-80 lg:block" aria-hidden>
            {(freeWorks ?? []).slice(0, 3).map((w, i) => (
              <span
                key={w.id}
                className="absolute block border-[6px] border-[#2b2b2b] bg-white p-3 shadow-[0_30px_60px_-30px_rgb(30_30_30/0.55)]"
                style={{ left: `${[4, 34, 62][i]}%`, top: `${[14, 0, 22][i]}%`, transform: `rotate(${[-3, 2, -1][i]}deg)` }}
              >
                <span className="block h-44 w-32 overflow-hidden">
                  <Img src={w.image} alt="" className="h-full w-full object-cover" />
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Filtres */}
      <section className="sticky top-20 z-30 border-y border-brand-green/10 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-night-bg/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-4 py-2 text-sm whitespace-nowrap transition ${
                  filter === f ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-ink hover:bg-brand-green/10 dark:bg-night-card dark:text-slate-300'
                }`}
              >
                {t(`artists.filters.${f}`)}
              </button>
            ))}
          </div>
          <label className="relative md:w-80">
            <span className="sr-only">{t('artists.searchLabel')}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('artists.searchLabel')} className="field rounded-full pl-10" />
          </label>
        </div>
      </section>

      {/* Galeries */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        {!isPending && <p className="mb-8 text-sm text-gray-500">{t('freeGalleries.count', { count: galleries.length })}</p>}
        {isPending ? (
          <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" aria-busy>
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="h-[420px] animate-pulse rounded-3xl bg-brand-mist dark:bg-night-card" />
            ))}
          </ul>
        ) : galleries.length ? (
          <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {galleries.map((a) => (
              <li key={a.id}>
                <GalleryCard artist={a} works={worksOf(a.id)} until={a.free_until ? dateFmt.format(new Date(a.free_until)) : null} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl bg-brand-mist p-10 text-center dark:bg-night-card">
            <p className="text-lg font-semibold text-brand-graphite dark:text-white">{t('freeGalleries.empty')}</p>
            <p className="mt-2 text-sm text-gray-500">{t('freeGalleries.emptyText')}</p>
            <Link to="/artistes" className="btn-secondary mt-6 rounded-full px-5">
              {t('artist.backToArtists')}
            </Link>
          </div>
        )}
      </section>

      {/* Œuvres en accès libre */}
      <section className="bg-brand-mist py-16 dark:bg-night-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="eyebrow">{t('freeGalleries.worksEyebrow')}</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight">{t('freeGalleries.worksTitle')}</h2>
          <div className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {isPending
              ? Array.from({ length: 4 }, (_, i) => <ArtworkCardSkeleton key={i} />)
              : (freeWorks ?? []).map((w) => <ArtworkCard key={w.id} artwork={w} free />)}
          </div>
        </div>
      </section>

      {/* Deux encarts : soutenir par un don, et ouvrir sa galerie gratuitement */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div className="rounded-3xl border border-brand-green/10 bg-white p-8 dark:border-white/10 dark:bg-night-card">
          <span className="grid size-12 place-items-center rounded-full bg-brand-orange/10 text-brand-orange">
            <Gift className="size-6" />
          </span>
          <h3 className="mt-5 text-xl font-semibold text-brand-graphite dark:text-white">{t('freeGalleries.donateTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{t('freeGalleries.donateText')}</p>
        </div>
        <div className="rounded-3xl border border-brand-green/10 bg-gradient-to-br from-white to-brand-mist p-8 dark:border-white/10 dark:from-night-card dark:to-night-field">
          <span className="grid size-12 place-items-center rounded-full bg-brand-green/10 text-brand-green">
            <Sparkles className="size-6" />
          </span>
          <h3 className="mt-5 text-xl font-semibold text-brand-graphite dark:text-white">{t('freeGalleries.artistTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{t('freeGalleries.artistText')}</p>
          <Link to="/inscription" className="btn-account mt-5">
            {t('nav.register')}
          </Link>
        </div>
      </section>
    </>
  )
}

/** Carte d'une galerie gratuite : villa, portrait, œuvres, durée de gratuité et actions. */
function GalleryCard({ artist, works, until }: { artist: CatalogArtist; works: CatalogArtwork[]; until: string | null }) {
  const { t } = useTranslation()

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-brand-green/10 bg-white shadow-[0_20px_60px_-40px_rgb(30_46_41/0.5)] transition hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgb(30_46_41/0.55)] dark:border-white/10 dark:bg-night-card">
      <Link to={`/artistes/${artist.id}`} className="relative block aspect-[16/10] overflow-hidden bg-brand-mist">
        <Img photo={villaPhoto(artist.address)} alt={t('artist.villaOf', { name: artist.name })} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-green shadow-sm">{t('artwork.free')}</span>
        <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs text-brand-graphite shadow-sm">
          <MapPin className="size-3.5 text-brand-orange" /> {t('artist.address', { n: artist.address })}
        </span>
      </Link>

      <div className="relative flex flex-1 flex-col px-6 pt-10 pb-6">
        <span className="absolute -top-8 left-6 block size-16 overflow-hidden rounded-full bg-brand-mist ring-4 ring-white dark:ring-night-card">
          <Img src={artist.photo ?? artist.cover} alt="" className="h-full w-full object-cover" />
        </span>
        <Link to={`/artistes/${artist.id}`} className="text-xl font-semibold text-brand-graphite hover:text-brand-green dark:text-white">
          {artist.name}
        </Link>
        <p className="text-sm text-gray-500">
          {artist.discipline && `${t(`discipline.${artist.discipline}`)} · `}
          {artist.city}, {artist.country}
        </p>

        {/* Durée de la gratuité */}
        <p className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${until ? 'bg-amber-50 text-amber-800' : 'bg-brand-green/[0.06] text-brand-green'}`}>
          <CalendarClock className="size-4 shrink-0" />
          {until ? t('freeGalleries.until', { date: until }) : t('freeGalleries.permanent')}
        </p>

        {/* Aperçu des œuvres */}
        {works.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            {works.slice(0, 3).map((w) => (
              <span key={w.id} className="block size-14 overflow-hidden rounded-lg bg-brand-mist">
                <Img src={w.image} alt={w.title} className="h-full w-full object-cover" />
              </span>
            ))}
            <span className="ml-1 text-xs text-gray-500">{t('freeGalleries.works', { count: artist.artwork_count || works.length })}</span>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          <Link to={`/ville/${artist.id}`} className="btn-primary flex-1 rounded-full py-2.5">
            <TrainFront className="size-4" /> {t('freeGalleries.visit')}
          </Link>
          <Link to={`/artistes/${artist.id}`} className="btn-secondary rounded-full px-4 py-2.5" aria-label={t('freeGalleries.details', { name: artist.name })}>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
