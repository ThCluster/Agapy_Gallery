import { ArrowUpRight, MapPin, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useArtists } from '@/api/catalog'
import { Img } from '@/components/ui/Img'
import { errorMessage } from '@/lib/api'

const FILTERS = ['all', 'peinture', 'photographie', 'sculpture', 'free'] as const
type Filter = (typeof FILTERS)[number]

/** Liste de tous les artistes, avec filtre par discipline et recherche par nom. */
export function ArtistsPage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const q = useDeferredValue(query.trim())
  // Filtres côté API (nom, discipline, gratuité), 24 artistes par page
  const { data, isPending, isError, error, isPlaceholderData } = useArtists({
    q: q || undefined,
    discipline: filter !== 'all' && filter !== 'free' ? filter : undefined,
    free: filter === 'free',
    page,
  })
  const list = data?.results ?? []

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="eyebrow">{t('artists.eyebrow')}</p>
      <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">{t('artists.title')}</h1>
      <p className="mt-3 max-w-2xl text-gray-500">{t('artists.subtitle')}</p>

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f)
                setPage(1)
              }}
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
          <input type="search" value={query} onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }} placeholder={t('artists.searchLabel')} className="field rounded-full pl-10" />
        </label>
      </div>

      {isPending ? (
        <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4" aria-busy>
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="animate-pulse">
              <span className="block aspect-[4/5] rounded-2xl bg-brand-mist dark:bg-night-card" />
              <span className="mt-4 block h-5 w-2/3 rounded bg-brand-mist dark:bg-night-card" />
              <span className="mt-2 block h-3 w-1/3 rounded bg-brand-mist dark:bg-night-card" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <p className="mt-12 rounded-3xl bg-brand-mist p-10 text-center text-gray-500 dark:bg-night-card">{errorMessage(error)}</p>
      ) : list.length ? (
        <ul className={`mt-10 grid ${isPlaceholderData ? 'opacity-60' : ''} grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4`}>
          {list.map((a) => (
            <li key={a.id}>
              <Link to={`/artistes/${a.id}`} className="group block">
                <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-brand-mist">
                  <Img src={a.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  {a.free && (
                    <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-green">{t('artwork.free')}</span>
                  )}
                  <span className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-white/95 text-brand-graphite opacity-0 shadow transition group-hover:opacity-100">
                    <ArrowUpRight className="size-5" />
                  </span>
                </span>
                <span className="mt-4 block text-lg font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{a.name}</span>
                <span className="block text-sm text-gray-500">{a.discipline ? t(`discipline.${a.discipline}`) : ' '}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="size-3.5" /> {a.city}, {a.country}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        // Message prévu au cahier des charges quand l'artiste recherché n'existe pas
        <div className="mt-12 rounded-3xl bg-brand-mist p-10 text-center dark:bg-night-card">
          <p className="text-lg font-semibold text-brand-graphite dark:text-white">{t('artist.notFound.title')}</p>
          <p className="mt-2 text-sm text-gray-500">{t('artist.notFound.text')}</p>
        </div>
      )}

      {/* Pagination (24 artistes par page) */}
      {data && (data.next || data.previous) && (
        <div className="mt-12 flex items-center justify-center gap-3">
          <button type="button" className="btn-secondary rounded-full px-5 py-2" disabled={!data.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t('common.previous')}
          </button>
          <span className="text-sm text-gray-500">{page}</span>
          <button type="button" className="btn-secondary rounded-full px-5 py-2" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
            {t('common.next')}
          </button>
        </div>
      )}
    </section>
  )
}
