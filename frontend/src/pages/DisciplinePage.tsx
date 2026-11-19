import { ArrowRight, ArrowUpRight, TrainFront } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useArtists, useArtworks, workRatio } from '@/api/catalog'
import { Img } from '@/components/ui/Img'
import { Presented } from '@/components/ui/Presented'
import { formatSize } from '@/lib/format'
import { displayPrice, PRICES, useRegion } from '@/lib/pricing'
import type { PhotoKey } from '@/mocks/photos'
import type { Discipline } from '@/types/catalog'

/** Œuvre phare (illustration fixe de l'en-tête) de chaque discipline */
const HERO: Record<Discipline, PhotoKey> = { peinture: 'art_a12', photographie: 'art_p3', sculpture: 'art_s1' }
const ROUTES: Record<Discipline, string> = { peinture: '/peinture', photographie: '/photographie', sculpture: '/sculpture' }
const DISCIPLINES: Discipline[] = ['peinture', 'photographie', 'sculpture']

type Access = 'all' | 'free' | 'paid'
type Sort = 'featured' | 'title' | 'artist'

export function DisciplinePage({ discipline }: { discipline: Discipline }) {
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  const [access, setAccess] = useState<Access>('all')
  const [sort, setSort] = useState<Sort>('featured')

  // Artistes et œuvres de la discipline (filtre côté API), tri et gratuité côté navigateur
  const artistsQuery = useArtists({ discipline, page_size: 100 })
  const worksQuery = useArtworks({ discipline, page_size: 100 })
  const disciplineArtists = useMemo(() => artistsQuery.data?.results ?? [], [artistsQuery.data])
  const allWorks = useMemo(() => worksQuery.data?.results ?? [], [worksQuery.data])
  const freeIds = useMemo(() => new Set(disciplineArtists.filter((a) => a.free).map((a) => a.id)), [disciplineArtists])
  const works = useMemo(() => {
    const list = allWorks.filter((w) => {
      const free = freeIds.has(w.artist_id)
      return access === 'all' || (access === 'free' ? free : !free)
    })
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title, i18n.resolvedLanguage))
    if (sort === 'artist') return [...list].sort((a, b) => a.artist_name.localeCompare(b.artist_name, i18n.resolvedLanguage))
    // « À la une » : recommandées et coups de cœur d'abord
    return [...list].sort((a, b) => Number(b.recommended || b.team_favorite) - Number(a.recommended || a.team_favorite))
  }, [allWorks, freeIds, access, sort, i18n.resolvedLanguage])
  const totalWorks = worksQuery.data?.count ?? 0
  const loading = artistsQuery.isPending || worksQuery.isPending
  const others = DISCIPLINES.filter((d) => d !== discipline)

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm whitespace-nowrap transition ${
      active ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-ink hover:bg-brand-green/10 dark:bg-night-card dark:text-slate-300'
    }`

  return (
    <>
      {/* En-tête : l'œuvre phare mise en scène */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_0%,rgb(255_255_255/0.95),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow">{t('disciplinePage.eyebrow')}</p>
            <h1 className="mt-3 text-5xl font-light tracking-tight sm:text-7xl">{t(`disciplinePage.${discipline}.title`)}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-500">{t(`disciplinePage.${discipline}.intro`)}</p>
            <div className="mt-8 flex flex-wrap items-end gap-8">
              <p>
                <span className="block text-3xl font-semibold text-brand-graphite dark:text-white">{disciplineArtists.length}</span>
                <span className="text-sm text-gray-500">{t('disciplinePage.statArtists', { count: disciplineArtists.length })}</span>
              </p>
              <p>
                <span className="block text-3xl font-semibold text-brand-graphite dark:text-white">{totalWorks}</span>
                <span className="text-sm text-gray-500">{t('disciplinePage.statWorks', { count: totalWorks })}</span>
              </p>
              <Link to="/ville" className="btn-action rounded-full px-6 py-3">
                <TrainFront className="size-4" /> {t('nav.visit')}
              </Link>
            </div>
          </div>
          <div className="flex justify-center py-6">
            <Presented discipline={discipline} photo={HERO[discipline]} alt="" large />
          </div>
        </div>
      </section>

      {/* Navigation entre disciplines + filtres */}
      <section className="sticky top-20 z-30 border-y border-brand-green/10 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-night-bg/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label={t('header.categories')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {DISCIPLINES.map((d) => (
              <Link key={d} to={ROUTES[d]} aria-current={d === discipline ? 'page' : undefined} className={chip(d === discipline)}>
                {t(`discipline.${d}`)}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'free', 'paid'] as const).map((a) => (
              <button key={a} type="button" onClick={() => setAccess(a)} aria-pressed={access === a} className={chip(access === a)}>
                {t(`disciplinePage.access.${a}`)}
              </button>
            ))}
            <label className="ml-auto lg:ml-2">
              <span className="sr-only">{t('disciplinePage.sortLabel')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field w-auto rounded-full py-2 text-sm">
                {(['featured', 'title', 'artist'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`disciplinePage.sort.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* Artistes de la discipline */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-light tracking-tight">{t(`disciplinePage.${discipline}.artists`)}</h2>
          <Link to="/artistes" className="link text-sm font-semibold">
            {t('artist.backToArtists')} →
          </Link>
        </div>
        <ul className="no-scrollbar -mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {loading &&
            Array.from({ length: 4 }, (_, i) => <li key={i} className="h-20 w-64 shrink-0 animate-pulse rounded-2xl bg-brand-mist dark:bg-night-card" aria-hidden />)}
          {disciplineArtists.map((a) => {
            const portrait = a.photo ?? a.cover
            return (
              <li key={a.id} className="shrink-0 snap-start">
                <Link to={`/artistes/${a.id}`} className="group flex w-64 items-center gap-4 rounded-2xl border border-brand-green/10 bg-white p-3 pr-4 transition hover:border-brand-green/30 hover:shadow-lg dark:border-white/10 dark:bg-night-card">
                  <span className="block size-14 shrink-0 overflow-hidden rounded-full bg-brand-mist">
                    <Img src={portrait} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{a.name}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {a.city}, {a.country}
                    </span>
                    {a.free && <span className="status-success mt-1">{t('artwork.free')}</span>}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-gray-400 group-hover:text-brand-green" />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Œuvres */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-light tracking-tight">{t('disciplinePage.worksTitle', { count: works.length })}</h2>
        {loading ? (
          <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4" aria-busy>
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="aspect-[4/5] animate-pulse bg-brand-mist dark:bg-night-card" />
            ))}
          </ul>
        ) : works.length ? (
          <ul className={`mt-8 columns-2 gap-6 md:columns-3 lg:columns-4 ${discipline === 'sculpture' ? '[&>li]:mb-14' : '[&>li]:mb-10'}`}>
            {works.map((w) => {
              const free = freeIds.has(w.artist_id)
              return (
                <li key={w.id} className="break-inside-avoid">
                  <Link to={`/oeuvres/${w.id}`} className="group block">
                    <span className="block transition duration-500 group-hover:-translate-y-1">
                      <Presented discipline={discipline} src={w.image} size={workRatio(w)} alt={`${w.title}, ${w.artist_name}`} />
                    </span>
                    <span className={`block ${discipline === 'sculpture' ? 'mt-4 text-center' : 'mt-3'}`}>
                      <span className="block truncate text-sm font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{w.title}</span>
                      <span className="block truncate text-sm text-brand-ink/80 dark:text-slate-300">{w.artist_name}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {w.technique} · {formatSize(w.size)}
                      </span>
                      <span className="price mt-1 block text-sm">{free ? t('artwork.free') : `${t('artwork.visit')} ${displayPrice(PRICES.visit, region, i18n.resolvedLanguage)}`}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-8 rounded-3xl bg-brand-mist p-10 text-center dark:bg-night-card">
            <p className="font-semibold text-brand-graphite dark:text-white">{t('disciplinePage.empty')}</p>
            <button type="button" onClick={() => setAccess('all')} className="btn-secondary mt-5 rounded-full px-5">
              {t('disciplinePage.access.all')}
            </button>
          </div>
        )}
      </section>

      {/* Les autres disciplines */}
      <section className="bg-brand-mist py-16 dark:bg-night-card">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2">
          {others.map((d) => (
            <Link key={d} to={ROUTES[d]} className="group relative flex h-56 items-end overflow-hidden rounded-3xl bg-white">
              <Img photo={HERO[d]} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <span className="relative flex w-full items-end justify-between p-6 text-white">
                <span>
                  <span className="block text-xs tracking-[0.18em] text-white/80 uppercase">{t('disciplinePage.discover')}</span>
                  <span className="block text-3xl font-light">{t(`disciplinePage.${d}.title`)}</span>
                </span>
                <span className="grid size-11 place-items-center rounded-full bg-white text-brand-graphite transition group-hover:bg-brand-yellow">
                  <ArrowRight className="size-5" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
