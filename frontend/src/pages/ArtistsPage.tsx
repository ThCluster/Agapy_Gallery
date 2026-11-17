import { ArrowUpRight, MapPin, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { artists } from '@/mocks/homeData'
import type { Discipline } from '@/types/catalog'

const FILTERS = ['all', 'peinture', 'photographie', 'sculpture', 'free'] as const
type Filter = (typeof FILTERS)[number]

/** Liste de tous les artistes, avec filtre par discipline et recherche par nom. */
export function ArtistsPage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return artists.filter((a) => {
      if (filter === 'free' && !a.free) return false
      if (filter !== 'all' && filter !== 'free' && a.discipline !== (filter as Discipline)) return false
      return !q || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.country.toLowerCase().includes(q)
    })
  }, [filter, query])

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

      {list.length ? (
        <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {list.map((a) => (
            <li key={a.id}>
              <Link to={`/artistes/${a.id}`} className="group block">
                <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-brand-mist">
                  <Img photo={a.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  {a.free && (
                    <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-green">{t('artwork.free')}</span>
                  )}
                  <span className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-white/95 text-brand-graphite opacity-0 shadow transition group-hover:opacity-100">
                    <ArrowUpRight className="size-5" />
                  </span>
                </span>
                <span className="mt-4 block text-lg font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{a.name}</span>
                <span className="block text-sm text-gray-500">{t(`discipline.${a.discipline}`)}</span>
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
    </section>
  )
}
