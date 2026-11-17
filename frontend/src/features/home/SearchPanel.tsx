import { Search } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { artists, freeGalleries, recommended, teamFavorites } from '@/mocks/homeData'

/** Les trois façons de chercher prévues au cahier des charges */
const MODES = ['artist', 'artwork', 'free'] as const
type Mode = (typeof MODES)[number]

const SUGGESTIONS: Record<Mode, string[]> = {
  artist: artists.map((a) => a.name),
  artwork: [...recommended, ...teamFavorites, ...freeGalleries].map((a) => a.title),
  free: [],
}

export function SearchPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const listId = useId()
  const [mode, setMode] = useState<Mode>('artist')
  const [query, setQuery] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (mode === 'free') return navigate(q ? `/galeries-gratuites?q=${encodeURIComponent(q)}` : '/galeries-gratuites')
    const params = new URLSearchParams({ mode })
    if (q) params.set('q', q)
    navigate(`/recherche?${params}`)
  }

  return (
    <form onSubmit={onSubmit} role="search" className="w-full max-w-2xl rounded-2xl border border-white/25 bg-white/10 p-2 shadow-2xl shadow-black/10 backdrop-blur-md">
      <div role="tablist" aria-label={t('search.label')} className="flex gap-1 p-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              setQuery('')
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              mode === m ? 'bg-white text-brand-green shadow-sm' : 'text-white/90 hover:bg-white/15'
            }`}
          >
            {t(`search.modes.${m}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 p-1">
        <label className="relative flex-1">
          <span className="sr-only">{t(`search.placeholders.${mode}`)}</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/70" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(`search.placeholders.${mode}`)}
            list={SUGGESTIONS[mode].length ? listId : undefined}
            className="h-13 w-full rounded-xl border border-white/25 bg-white/10 pr-3 pl-12 text-[15px] text-white placeholder:text-white/65 focus:border-white/60 focus:bg-white/20 focus:outline-none"
          />
          <datalist id={listId}>
            {SUGGESTIONS[mode].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <button type="submit" className="btn-primary h-13 rounded-xl px-5 text-[15px] sm:px-7">
          <span className="hidden sm:inline">{t('search.submit')}</span>
          <Search className="size-5 sm:hidden" aria-label={t('search.submit')} />
        </button>
      </div>
    </form>
  )
}
