import { Globe, Menu, Search, TrainFront, User, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { SUPPORTED_LANGUAGES } from '@/i18n'

const LINKS = [
  { key: 'painting', to: '/peinture' },
  { key: 'photography', to: '/photographie' },
  { key: 'sculpture', to: '/sculpture' },
  { key: 'artists', to: '/artistes' },
  { key: 'freeGalleries', to: '/galeries-gratuites' },
  { key: 'exhibit', to: '/inscription' },
] as const

/**
 * Barre de navigation sur une seule ligne.
 * Sur l'accueil, elle est transparente au-dessus de la photo puis devient
 * blanche translucide (effet verre) dès que l'on fait défiler la page.
 */
export function SiteHeader() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  // Menu mobile et recherche liés à la page où ils ont été ouverts : ils se ferment au changement de page
  const [menuOn, setMenuOn] = useState<string | null>(null)
  const [searchOn, setSearchOn] = useState<string | null>(null)
  const menuOpen = menuOn === location.key
  const searchOpen = searchOn === location.key
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen])

  // Échap ferme la recherche et le menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOn(null)
        setMenuOn(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const solid = !isHome || scrolled || menuOpen || searchOpen
  const tone = solid ? 'text-brand-graphite dark:text-white' : 'text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.35)]'
  const iconBtn = `grid size-10 place-items-center rounded-full transition ${solid ? 'hover:bg-brand-mist dark:hover:bg-night-field' : 'hover:bg-white/15'}`

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/recherche?q=${encodeURIComponent(q)}` : '/recherche')
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        solid ? 'bg-white/85 shadow-[0_1px_0_rgb(0_103_79/0.08),0_8px_30px_-12px_rgb(30_46_41/0.15)] backdrop-blur-xl dark:bg-night-bg/85' : 'bg-transparent'
      }`}
    >
      <div className={`mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 sm:px-6 ${tone}`}>
        <Link to="/" aria-label={t('header.home')} className="shrink-0">
          <Logo
            variant={solid ? 'color' : 'white'}
            className={`h-8 sm:h-9 ${solid ? '' : 'drop-shadow-[0_1px_10px_rgb(0_0_0/0.35)]'}`}
          />
        </Link>

        {/* Disciplines, au centre */}
        <nav aria-label={t('header.categories')} className="hidden flex-1 justify-center xl:flex">
          <ul className="flex items-center gap-0.5 text-[15px] whitespace-nowrap">
            {LINKS.map((l) => (
              <li key={l.key}>
                <NavLink
                  to={l.to}
                  className={`relative rounded-full px-3 py-2 transition ${solid ? 'hover:text-brand-green' : 'hover:bg-white/15'} ${
                    l.key === 'exhibit' ? 'font-semibold' : ''
                  }`}
                >
                  {t(`header.links.${l.key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 xl:ml-0">
          <button
            type="button"
            onClick={() => setSearchOn(searchOpen ? null : location.key)}
            className={iconBtn}
            aria-label={t('nav.search')}
            aria-expanded={searchOpen}
          >
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </button>

          <label className={`hidden items-center gap-1 rounded-full px-2 py-2 text-sm uppercase sm:flex ${solid ? 'hover:bg-brand-mist dark:hover:bg-night-field' : 'hover:bg-white/15'}`}>
            <Globe className="size-4" />
            <span className="sr-only">{t('header.language')}</span>
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="cursor-pointer appearance-none bg-transparent uppercase focus:outline-none [&>option]:text-brand-graphite"
            >
              {SUPPORTED_LANGUAGES.map((lng) => (
                <option key={lng} value={lng}>
                  {lng}
                </option>
              ))}
            </select>
          </label>

          <Link to="/connexion" className={`hidden sm:grid ${iconBtn}`} aria-label={t('nav.login')} title={t('nav.login')}>
            <User className="size-5" />
          </Link>

          <Link to="/ville" className="btn-action ml-2 hidden rounded-full px-5 py-2.5 whitespace-nowrap shadow-lg shadow-brand-orange/25 md:inline-flex">
            <TrainFront className="size-4" /> {t('nav.visit')}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOn(menuOpen ? null : location.key)}
            className={`xl:hidden ${iconBtn}`}
            aria-label={t('header.menu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* Recherche déroulante */}
      {searchOpen && (
        <div className="border-t border-brand-green/10 bg-white/95 backdrop-blur-xl dark:bg-night-bg/95">
          <form onSubmit={onSearch} role="search" className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5 sm:px-6">
            <Search className="size-6 shrink-0 text-brand-green" />
            <input
              ref={searchInput}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('nav.search')}
              className="min-w-0 flex-1 bg-transparent text-xl font-light text-brand-graphite placeholder:text-gray-400 focus:outline-none dark:text-white"
            />
            <button type="submit" className="btn-primary rounded-full px-5">
              {t('nav.search')}
            </button>
          </form>
        </div>
      )}

      {/* Menu mobile */}
      {menuOpen && (
        <nav aria-label={t('header.menu')} className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-brand-green/10 bg-white xl:hidden dark:bg-night-bg">
          <ul className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            {LINKS.map((l) => (
              <li key={l.key}>
                <Link to={l.to} className="flex items-center justify-between border-b border-brand-graphite/5 py-4 text-lg text-brand-graphite dark:text-white">
                  {t(`header.links.${l.key}`)} <span className="text-brand-green">→</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-6 sm:px-6">
            <Link to="/ville" className="btn-action w-full rounded-full py-3 text-base">
              <TrainFront className="size-5" /> {t('nav.visit')}
            </Link>
            <Link to="/connexion" className="btn-secondary w-full rounded-full py-3 text-base">
              <User className="size-5" /> {t('nav.login')}
            </Link>
            <div className="flex justify-center gap-2 pt-2">
              {SUPPORTED_LANGUAGES.map((lng) => (
                <button
                  key={lng}
                  type="button"
                  onClick={() => i18n.changeLanguage(lng)}
                  className={`rounded-full px-4 py-1.5 text-sm uppercase ${i18n.resolvedLanguage === lng ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-graphite'}`}
                >
                  {lng}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
