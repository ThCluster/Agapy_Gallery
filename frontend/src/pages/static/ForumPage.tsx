import { BookOpen, Brush, Building2, CalendarDays, HandHelping, Lock, MessageSquare, Pin, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

const CATEGORIES = ['mutual', 'techniques', 'copyright', 'events', 'city'] as const
type Category = (typeof CATEGORIES)[number]

const ICONS: Record<Category, LucideIcon> = {
  mutual: HandHelping,
  techniques: Brush,
  copyright: Scale,
  events: CalendarDays,
  city: Building2,
}

interface Topic {
  id: number
  category: Category
  /** Titre rédigé par l’artiste : contenu utilisateur, non traduit */
  title: string
  author: string
  replies: number
  /** Ancienneté de la dernière réponse, en heures (données fictives) */
  hoursAgo: number
  pinned?: boolean
}

/** Sujets fictifs, en attendant l’API du forum */
const TOPICS: Topic[] = [
  { id: 1, category: 'mutual', title: 'Bienvenue sur le forum : présentez-vous ici', author: 'Équipe AGAPY', replies: 128, hoursAgo: 1, pinned: true },
  { id: 2, category: 'mutual', title: 'Comment bien photographier ses toiles pour la galerie ?', author: 'Kofi_Art', replies: 34, hoursAgo: 3 },
  { id: 3, category: 'mutual', title: 'Galerie gratuite ou payante : vos retours d’expérience', author: 'AminataD', replies: 21, hoursAgo: 9 },
  { id: 4, category: 'techniques', title: 'Pigments naturels : terre de Kaolack, indigo, kola', author: 'Seydou.Pigments', replies: 47, hoursAgo: 5 },
  { id: 5, category: 'techniques', title: 'Numériser une sculpture en 3D avec un simple téléphone', author: 'Nia_Bronze', replies: 18, hoursAgo: 26 },
  { id: 6, category: 'techniques', title: 'Quel éclairage pour une prise de vue sans reflets ?', author: 'LumièreAbidjan', replies: 12, hoursAgo: 50 },
  { id: 7, category: 'copyright', title: 'Déclarer ses œuvres au BURIDA : mode d’emploi', author: 'Maître_Konan', replies: 29, hoursAgo: 4, pinned: true },
  { id: 8, category: 'copyright', title: 'Œuvre à plusieurs mains : comment répartir les droits ?', author: 'Collectif Wax', replies: 15, hoursAgo: 30 },
  { id: 9, category: 'events', title: 'Biennale de Dakar : qui expose cette année ?', author: 'Fatou_Ndiaye', replies: 41, hoursAgo: 2 },
  { id: 10, category: 'events', title: 'Appel à candidatures : résidence d’artistes à Grand-Bassam', author: 'Fondation Lagune', replies: 9, hoursAgo: 72 },
  { id: 11, category: 'city', title: 'Idées pour le quartier des sculpteurs', author: 'Ebène_Studio', replies: 23, hoursAgo: 7 },
  { id: 12, category: 'city', title: 'Accrochage dans la villa : combien d’œuvres par salle ?', author: 'Kofi_Art', replies: 16, hoursAgo: 120 },
]

/** Forum de discussion : lecture libre, publication réservée aux artistes connectés. */
export function ForumPage() {
  const { t, i18n } = useTranslation()
  const [category, setCategory] = useState<Category | 'all'>('all')
  const rtf = new Intl.RelativeTimeFormat(i18n.resolvedLanguage, { numeric: 'auto' })
  const ago = (hours: number) => (hours < 24 ? rtf.format(-hours, 'hour') : rtf.format(-Math.round(hours / 24), 'day'))

  const topics = TOPICS.filter((tp) => category === 'all' || tp.category === category).sort(
    (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.hoursAgo - b.hoursAgo,
  )
  const count = (c: Category) => TOPICS.filter((tp) => tp.category === c).length

  return (
    <>
      <header className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">{t('static.forum.eyebrow')}</p>
            <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight text-brand-graphite sm:text-6xl dark:text-white">{t('static.forum.title')}</h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-500 dark:text-slate-400">{t('static.forum.lead')}</p>
          </div>
          <div className="max-w-sm rounded-3xl bg-white p-6 shadow-[0_30px_70px_-50px_rgb(30_46_41/0.5)] dark:bg-night-card">
            <p className="flex items-start gap-2 text-sm text-brand-ink dark:text-slate-300">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-brand-green dark:text-emerald-400" />
              {t('static.forum.readOpen')}
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm text-gray-500 dark:text-slate-400">
              <Lock className="mt-0.5 size-4 shrink-0 text-brand-orange" />
              {t('static.forum.postNote')}
            </p>
            <Link to="/connexion" className="btn-action mt-5 w-full rounded-full py-3">
              <MessageSquare className="size-4" /> {t('static.forum.publish')}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-[18rem_1fr]">
        {/* Catégories */}
        <nav aria-label={t('static.forum.categoriesLabel')} className="lg:sticky lg:top-28 lg:self-start">
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setCategory('all')}
                aria-pressed={category === 'all'}
                className={`w-full rounded-full px-4 py-2 text-left text-sm whitespace-nowrap transition lg:rounded-2xl lg:py-3 ${
                  category === 'all' ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-ink hover:bg-brand-green/10 dark:bg-night-card dark:text-slate-300'
                }`}
              >
                {t('static.forum.all')}
              </button>
            </li>
            {CATEGORIES.map((c) => {
              const Icon = ICONS[c]
              const active = category === c
              return (
                <li key={c} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={active}
                    className={`flex w-full items-start gap-3 rounded-full px-4 py-2 text-left text-sm transition lg:rounded-2xl lg:py-3 ${
                      active ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-ink hover:bg-brand-green/10 dark:bg-night-card dark:text-slate-300'
                    }`}
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${active ? 'text-white' : 'text-brand-orange'}`} />
                    <span>
                      <span className="block font-medium whitespace-nowrap">{t(`static.forum.categories.${c}.title`)}</span>
                      <span className={`hidden text-xs lg:block ${active ? 'text-white/80' : 'text-gray-500'}`}>{t(`static.forum.categories.${c}.text`)}</span>
                      <span className={`hidden text-xs lg:block ${active ? 'text-white/70' : 'text-gray-400'}`}>{t('static.forum.topicsCount', { count: count(c) })}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Sujets */}
        <section aria-labelledby="forum-topics">
          <h2 id="forum-topics" className="text-2xl font-light tracking-tight text-brand-graphite dark:text-white">
            {category === 'all' ? t('static.forum.all') : t(`static.forum.categories.${category}.title`)}
            <span className="ml-3 text-sm text-gray-400">{t('static.forum.topicsCount', { count: topics.length })}</span>
          </h2>
          <div className="mt-6 hidden grid-cols-[1fr_7rem_9rem] gap-4 border-b border-brand-green/10 px-5 pb-3 text-xs font-semibold tracking-[0.15em] text-gray-400 uppercase sm:grid dark:border-white/10">
            <span>{t('static.forum.topic')}</span>
            <span className="text-right">{t('static.forum.repliesHeader')}</span>
            <span className="text-right">{t('static.forum.lastActivity')}</span>
          </div>
          <ul className="mt-2 divide-y divide-brand-green/10 sm:mt-0 dark:divide-white/10">
            {topics.map((tp) => (
              <li key={tp.id} className="grid gap-2 rounded-2xl px-5 py-5 transition hover:bg-brand-mist sm:grid-cols-[1fr_7rem_9rem] sm:items-center sm:gap-4 dark:hover:bg-night-card">
                <div className="min-w-0">
                  <p className="flex items-start gap-2 font-medium text-brand-graphite dark:text-white">
                    {tp.pinned && (
                      <span className="status-pending mt-0.5 shrink-0 gap-1">
                        <Pin className="size-3" /> {t('static.forum.pinned')}
                      </span>
                    )}
                    <span className="break-words">{tp.title}</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('static.forum.by', { author: tp.author })}
                    {category === 'all' && <> · {t(`static.forum.categories.${tp.category}.title`)}</>}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-gray-500 sm:justify-end">
                  <MessageSquare className="size-3.5 sm:hidden" />
                  <span className="sm:hidden">{t('static.forum.replies', { count: tp.replies })}</span>
                  <span className="hidden font-semibold text-brand-graphite sm:inline dark:text-white">{tp.replies}</span>
                </p>
                <p className="text-sm text-gray-500 sm:text-right">{ago(tp.hoursAgo)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
