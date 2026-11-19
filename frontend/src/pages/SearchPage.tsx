import { ArrowUpRight, Gift, Info, MapPin, Search, SearchX, TrainFront, UserSearch } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useArtists, useArtworks, useSearch, type CatalogArtist, type CatalogArtwork, type SearchResult, workRatio } from '@/api/catalog'
import { Img } from '@/components/ui/Img'
import { errorMessage } from '@/lib/api'
import { formatSize } from '@/lib/format'
import { displayPrice, PRICES, useRegion } from '@/lib/pricing'
import { closest, normalize } from '@/lib/search'

type Mode = 'artist' | 'artwork'

/**
 * Recherche (cahier des charges, p. 10) : par nom d'artiste ou par titre d'œuvre.
 * Si l'artiste n'existe pas : « l'artiste recherché ne figure pas sur AGAPY-GALLERY ».
 * Si plusieurs artistes ont une œuvre du même titre : on aide à préciser avec le nom de l'artiste.
 */
export function SearchPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'artwork' ? 'artwork' : 'artist'
  const q = params.get('q') ?? ''
  const byArtist = params.get('artiste') ?? ''

  // Champs du formulaire, resynchronisés quand l'adresse change (retour arrière, liens)
  const [draft, setDraft] = useState({ q, byArtist })
  const [synced, setSynced] = useState({ q, byArtist })
  if (synced.q !== q || synced.byArtist !== byArtist) {
    setSynced({ q, byArtist })
    setDraft({ q, byArtist })
  }

  const submit = (e?: FormEvent, next: Partial<{ mode: Mode; q: string; artiste: string }> = {}) => {
    e?.preventDefault()
    const p = new URLSearchParams()
    p.set('mode', next.mode ?? mode)
    const query = (next.q ?? draft.q).trim()
    const artist = (next.artiste ?? draft.byArtist).trim()
    if (query) p.set('q', query)
    if ((next.mode ?? mode) === 'artwork' && artist) p.set('artiste', artist)
    setParams(p)
  }

  const tab = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-brand-green text-white' : 'text-brand-ink hover:bg-brand-mist dark:text-slate-300 dark:hover:bg-night-card'}`

  return (
    <>
      <section className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="eyebrow text-center">{t('search.page.eyebrow')}</p>
          <h1 className="mt-3 text-center text-4xl font-light tracking-tight sm:text-5xl">{t('search.page.title')}</h1>

          <form onSubmit={submit} role="search" className="mt-10 rounded-3xl border border-brand-green/10 bg-white p-3 shadow-[0_30px_80px_-50px_rgb(30_46_41/0.5)] dark:border-white/10 dark:bg-night-card">
            <div role="tablist" aria-label={t('search.label')} className="flex flex-wrap gap-1 p-1">
              <button type="button" role="tab" aria-selected={mode === 'artist'} className={tab(mode === 'artist')} onClick={() => submit(undefined, { mode: 'artist' })}>
                {t('search.modes.artist')}
              </button>
              <button type="button" role="tab" aria-selected={mode === 'artwork'} className={tab(mode === 'artwork')} onClick={() => submit(undefined, { mode: 'artwork' })}>
                {t('search.modes.artwork')}
              </button>
              <button type="button" role="tab" aria-selected={false} className={tab(false)} onClick={() => navigate(draft.q ? `/galeries-gratuites?q=${encodeURIComponent(draft.q)}` : '/galeries-gratuites')}>
                {t('search.modes.free')}
              </button>
            </div>
            <div className="flex flex-col gap-2 p-1 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">{t(`search.placeholders.${mode}`)}</span>
                <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={draft.q}
                  onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                  placeholder={t(`search.placeholders.${mode}`)}
                  autoFocus
                  className="h-14 w-full rounded-2xl bg-brand-mist pr-3 pl-12 text-[15px] text-brand-graphite placeholder:text-gray-400 focus:ring-2 focus:ring-brand-orange focus:outline-none dark:bg-night-field dark:text-white"
                />
              </label>
              {/* Pour départager des œuvres de même titre : titre + nom de l'artiste */}
              {mode === 'artwork' && (
                <label className="relative sm:w-64">
                  <span className="sr-only">{t('search.page.artistFilter')}</span>
                  <UserSearch className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={draft.byArtist}
                    onChange={(e) => setDraft((d) => ({ ...d, byArtist: e.target.value }))}
                    placeholder={t('search.page.artistFilter')}
                    className="h-14 w-full rounded-2xl bg-brand-mist pr-3 pl-12 text-[15px] text-brand-graphite placeholder:text-gray-400 focus:ring-2 focus:ring-brand-orange focus:outline-none dark:bg-night-field dark:text-white"
                  />
                </label>
              )}
              <button type="submit" className="btn-primary h-14 rounded-2xl px-8 text-[15px]">
                {t('search.submit')}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {!q ? <EmptyQuery mode={mode} /> : mode === 'artist' ? <ArtistResults q={q} /> : <ArtworkResults q={q} byArtist={byArtist} onRefine={(name) => submit(undefined, { artiste: name })} />}
      </section>
    </>
  )
}

/* ───────────── Avant toute recherche ───────────── */
function EmptyQuery({ mode }: { mode: Mode }) {
  const { t } = useTranslation()
  const artists = useArtists({ page_size: 8 })
  const works = useArtworks({ recommended: true, page_size: 8 })
  const labels = mode === 'artist' ? (artists.data?.results ?? []).map((a) => a.name) : [...new Set((works.data?.results ?? []).map((w) => w.title))]
  return (
    <div>
      <p className="text-sm text-gray-500">{t(mode === 'artist' ? 'search.page.tryArtists' : 'search.page.tryWorks')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {labels.map((label) => (
          <Link
            key={label}
            to={`/recherche?mode=${mode}&q=${encodeURIComponent(label)}`}
            className="rounded-full border border-brand-green/20 px-4 py-2 text-sm text-brand-ink transition hover:border-brand-green hover:bg-brand-green hover:text-white dark:text-slate-300"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Chargement et erreur communs aux deux recherches */
function SearchStatus({ query }: { query: { isPending: boolean; isError: boolean; error: unknown } }) {
  if (query.isPending)
    return (
      <ul className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-brand-mist dark:bg-night-card" />
        ))}
      </ul>
    )
  return <p className="rounded-3xl bg-brand-mist p-10 text-center text-gray-500 dark:bg-night-card">{errorMessage(query.error, 'q')}</p>
}

/** Message du serveur (codes artist_not_found / artwork_not_found), traduit */
function useNotFoundText(data: SearchResult | undefined, fallback: string): string {
  const { t } = useTranslation()
  return data?.code ? t(`errors.${data.code}`, { defaultValue: data.detail || fallback }) : fallback
}

/* ───────────── Recherche par nom d'artiste ───────────── */
function ArtistResults({ q }: { q: string }) {
  const { t } = useTranslation()
  const query = useSearch({ artist: q })
  const all = useArtists({ page_size: 100 })
  const data = query.data
  const results = data?.artists ?? []
  const suggestions = useMemo(() => (data && !data.artists.length ? closest(all.data?.results ?? [], (a) => a.name, q) : []), [data, all.data, q])
  const notFound = useNotFoundText(data, t('search.page.artistNotFoundText', { q }))

  if (!data) return <SearchStatus query={query} />
  if (!results.length) {
    return (
      <NotFound title={t('artist.notFound.title')} text={notFound}>
        {suggestions.length > 0 && (
          <p className="mt-6 text-sm text-brand-ink dark:text-slate-300">
            {t('search.page.didYouMean')}{' '}
            {suggestions.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ', '}
                <Link to={`/artistes/${a.id}`} className="link font-semibold">
                  {a.name}
                </Link>
              </span>
            ))}
            {' ?'}
          </p>
        )}
        <Link to="/artistes" className="btn-secondary mt-6 rounded-full px-5">
          {t('artist.backToArtists')}
        </Link>
      </NotFound>
    )
  }

  return (
    <>
      <p className="mb-8 text-sm text-gray-500">{t('search.page.artistCount', { count: results.length, q })}</p>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {results.map((a) => (
          <li key={a.id}>
            <ArtistCard artist={a} />
          </li>
        ))}
      </ul>
    </>
  )
}

function ArtistCard({ artist }: { artist: CatalogArtist }) {
  const { t } = useTranslation()
  return (
    <Link to={`/artistes/${artist.id}`} className="group block">
      <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-brand-mist">
        <Img src={artist.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        {artist.free && <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-green">{t('artwork.free')}</span>}
      </span>
      <span className="mt-4 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{artist.name}</span>
        <ArrowUpRight className="size-5 shrink-0 text-gray-400 group-hover:text-brand-green" />
      </span>
      {artist.discipline && <span className="block text-sm text-gray-500">{t(`discipline.${artist.discipline}`)}</span>}
      <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
        <MapPin className="size-3.5" /> {artist.city}, {artist.country}
      </span>
    </Link>
  )
}

/* ───────────── Recherche par titre d'œuvre (et, au besoin, nom de l'artiste) ───────────── */
function ArtworkResults({ q, byArtist, onRefine }: { q: string; byArtist: string; onRefine: (artistName: string) => void }) {
  const { t } = useTranslation()
  const query = useSearch({ title: q, artist: byArtist || undefined })
  const all = useArtworks({ page_size: 100 })
  const data = query.data
  const artistsById = useMemo(() => new Map((data?.artists ?? []).map((a) => [a.id, a])), [data])
  const fallback = byArtist ? t('search.page.artworkNotFoundBy', { q, artist: byArtist }) : t('search.page.artworkNotFoundText', { q })
  const notFound = useNotFoundText(data, fallback)

  // Homonymes : plusieurs artistes ont une œuvre portant exactement le même titre
  const homonyms = useMemo(() => {
    if (byArtist || !data) return []
    const groups = new Map<string, Map<string, string>>()
    for (const w of data.artworks) {
      const key = normalize(w.title)
      if (!groups.has(key)) groups.set(key, new Map())
      groups.get(key)!.set(w.artist_id, w.artist_name)
    }
    const names = [...groups.values()].find((ids) => ids.size > 1)
    return names ? [...names.entries()].map(([id, name]) => ({ id, name })) : []
  }, [data, byArtist])

  if (!data) return <SearchStatus query={query} />
  const results = data.artworks
  if (!results.length) {
    const suggestions = closest(all.data?.results ?? [], (w) => w.title, q)
    return (
      <NotFound title={data.code === 'artist_not_found' ? t('artist.notFound.title') : t('search.page.artworkNotFound')} text={notFound}>
        {suggestions.length > 0 && (
          <p className="mt-6 text-sm text-brand-ink dark:text-slate-300">
            {t('search.page.didYouMean')}{' '}
            {suggestions.map((w, i) => (
              <span key={w.id}>
                {i > 0 && ', '}
                <Link to={`/recherche?mode=artwork&q=${encodeURIComponent(w.title)}`} className="link font-semibold">
                  {w.title}
                </Link>
              </span>
            ))}
            {' ?'}
          </p>
        )}
      </NotFound>
    )
  }

  return (
    <>
      {homonyms.length > 0 && (
        <div role="status" className="mb-10 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="flex items-start gap-2 font-semibold">
            <Info className="mt-0.5 size-5 shrink-0" /> {t('search.page.homonymsTitle', { count: homonyms.length })}
          </p>
          <p className="mt-1 pl-7 text-sm">{t('search.page.homonymsText')}</p>
          <div className="mt-4 flex flex-wrap gap-2 pl-7">
            {homonyms.map((a) => (
              <button key={a.id} type="button" onClick={() => onRefine(a.name)} className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium hover:border-brand-green hover:text-brand-green">
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mb-8 text-sm text-gray-500">
        {byArtist ? t('search.page.artworkCountBy', { count: results.length, q, artist: byArtist }) : t('search.page.artworkCount', { count: results.length, q })}
      </p>
      <ul className="grid gap-6 md:grid-cols-2">
        {results.map((w) => (
          <li key={w.id}>
            <WorkResult work={w} artist={artistsById.get(w.artist_id)} />
          </li>
        ))}
      </ul>
    </>
  )
}

/** Œuvre trouvée : le visiteur peut s'arrêter, visiter, donner, ou les deux (p. 11). */
function WorkResult({ work, artist }: { work: CatalogArtwork; artist?: CatalogArtist }) {
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  const ph = workRatio(work)
  const free = !!artist?.free

  return (
    <article className="flex h-full gap-5 rounded-3xl border border-brand-green/10 bg-white p-4 transition hover:shadow-[0_24px_60px_-40px_rgb(30_46_41/0.5)] sm:p-5 dark:border-white/10 dark:bg-night-card">
      <Link to={`/oeuvres/${work.id}`} className="shrink-0 self-start bg-white p-2 shadow-[0_12px_30px_-14px_rgb(30_46_41/0.45)]">
        <span className={`block overflow-hidden ${ph.height >= ph.width ? 'h-36 sm:h-44' : 'w-32 sm:w-44'}`} style={{ aspectRatio: `${ph.width} / ${ph.height}` }}>
          <Img src={work.image} alt={work.title} className="h-full w-full object-cover" />
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-lg font-semibold text-brand-graphite dark:text-white">{work.title}</p>
        <Link to={`/artistes/${work.artist_id}`} className="flex items-center gap-2 text-sm text-brand-ink hover:text-brand-green dark:text-slate-300">
          {artist?.photo && (
            <span className="block size-6 overflow-hidden rounded-full">
              <Img src={artist.photo} alt="" className="h-full w-full object-cover" />
            </span>
          )}
          {work.artist_name}
        </Link>
        <p className="mt-1 text-xs text-gray-500">
          {work.technique} · {formatSize(work.size)}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {free ? (
            <Link to={`/ville/${work.artist_id}`} className="btn-primary rounded-full px-4 py-2 text-xs sm:text-sm">
              <TrainFront className="size-4" /> {t('freeGalleries.visit')}
            </Link>
          ) : (
            <Link to={`/artistes/${work.artist_id}#support`} className="btn-primary rounded-full px-4 py-2 text-xs sm:text-sm">
              {t('search.page.visit', { price: displayPrice(PRICES.visit, region, i18n.resolvedLanguage) })}
            </Link>
          )}
          <Link to={`/artistes/${work.artist_id}#support`} className="btn-secondary rounded-full px-4 py-2 text-xs sm:text-sm">
            <Gift className="size-4" /> {t('artist.support.donate')}
          </Link>
        </div>
      </div>
    </article>
  )
}

function NotFound({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-brand-mist p-10 text-center dark:bg-night-card">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-white text-brand-orange dark:bg-night-field">
        <SearchX className="size-7" />
      </span>
      <p className="mt-5 text-xl font-semibold text-brand-graphite dark:text-white">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{text}</p>
      {children}
    </div>
  )
}
