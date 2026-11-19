import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Brush,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HandHelping,
  Loader2,
  Lock,
  MessageSquare,
  Pin,
  Scale,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { createTopic, FORUM_PAGE_SIZE, useForumCategories, useForumTopics, type ForumCategory } from '@/api/forum'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { apiFieldErrors } from './formErrors'
import { useAgo } from './useAgo'

/** Icône des catégories connues ; les autres prennent une bulle de discussion */
const ICONS: Record<string, LucideIcon> = {
  mutual: HandHelping,
  entraide: HandHelping,
  techniques: Brush,
  copyright: Scale,
  'droits-auteur': Scale,
  events: CalendarDays,
  evenements: CalendarDays,
  city: Building2,
  'ville-3d': Building2,
}

/** Forum de discussion : lecture libre, publication réservée aux artistes connectés. */
export function ForumPage() {
  const { t } = useTranslation()
  const ago = useAgo()
  const authenticated = useAuth((s) => s.status === 'authenticated')
  const [params, setParams] = useSearchParams()
  const category = params.get('categorie') ?? ''
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(q)
  const [composing, setComposing] = useState(false)

  const categories = useForumCategories()
  const topics = useForumTopics({ category: category || undefined, q: q || undefined, page })
  const pages = Math.max(1, Math.ceil((topics.data?.count ?? 0) / FORUM_PAGE_SIZE))
  const current = categories.data?.find((c) => c.slug === category)

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next)
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setParam({ q: search.trim() || null, page: null })
  }

  const openComposer = () => {
    setComposing(true)
    requestAnimationFrame(() => document.getElementById('forum-new')?.scrollIntoView({ behavior: 'smooth' }))
  }

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
            {!authenticated && (
              <p className="mt-2 flex items-start gap-2 text-sm text-gray-500 dark:text-slate-400">
                <Lock className="mt-0.5 size-4 shrink-0 text-brand-orange" />
                {t('static.forum.postNote')}
              </p>
            )}
            {authenticated ? (
              <button type="button" onClick={openComposer} disabled={!categories.data?.length} className="btn-action mt-5 w-full rounded-full py-3">
                <MessageSquare className="size-4" /> {t('static.forum.publish')}
              </button>
            ) : (
              <Link to="/connexion" className="btn-action mt-5 w-full rounded-full py-3">
                <MessageSquare className="size-4" /> {t('content.forum.loginToPost')}
              </Link>
            )}
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
                onClick={() => setParam({ categorie: null, page: null })}
                aria-pressed={!category}
                className={`w-full rounded-full px-4 py-2 text-left text-sm whitespace-nowrap transition lg:rounded-2xl lg:py-3 ${
                  !category ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-ink hover:bg-brand-green/10 dark:bg-night-card dark:text-slate-300'
                }`}
              >
                {t('static.forum.all')}
              </button>
            </li>
            {categories.isLoading && (
              <li className="flex items-center px-4 py-2">
                <Loader2 className="size-4 animate-spin text-brand-orange" aria-label={t('content.loading')} />
              </li>
            )}
            {categories.data?.map((c) => {
              const Icon = ICONS[c.slug] ?? MessageSquare
              const active = category === c.slug
              return (
                <li key={c.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setParam({ categorie: c.slug, page: null })}
                    aria-pressed={active}
                    className={`flex w-full items-start gap-3 rounded-full px-4 py-2 text-left text-sm transition lg:rounded-2xl lg:py-3 ${
                      active ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-ink hover:bg-brand-green/10 dark:bg-night-card dark:text-slate-300'
                    }`}
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${active ? 'text-white' : 'text-brand-orange'}`} />
                    <span>
                      <span className="block font-medium whitespace-nowrap">{c.name}</span>
                      {c.description && <span className={`hidden text-xs lg:block ${active ? 'text-white/80' : 'text-gray-500'}`}>{c.description}</span>}
                      <span className={`hidden text-xs lg:block ${active ? 'text-white/70' : 'text-gray-400'}`}>
                        {t('static.forum.topicsCount', { count: c.topic_count })}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Sujets */}
        <section aria-labelledby="forum-topics">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="forum-topics" className="text-2xl font-light tracking-tight text-brand-graphite dark:text-white">
              {current?.name ?? t('static.forum.all')}
              {topics.data && <span className="ml-3 text-sm text-gray-400">{t('static.forum.topicsCount', { count: topics.data.count })}</span>}
            </h2>
            <form role="search" onSubmit={onSearch} className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('content.forum.searchPlaceholder')}
                aria-label={t('content.forum.searchPlaceholder')}
                className={`${inputClass()} !py-2.5 pl-10`}
              />
            </form>
          </div>

          {composing && authenticated && categories.data && (
            <NewTopicForm categories={categories.data} defaultCategory={category} onClose={() => setComposing(false)} />
          )}

          <div className="mt-6 hidden grid-cols-[1fr_7rem_9rem] gap-4 border-b border-brand-green/10 px-5 pb-3 text-xs font-semibold tracking-[0.15em] text-gray-400 uppercase sm:grid dark:border-white/10">
            <span>{t('static.forum.topic')}</span>
            <span className="text-right">{t('static.forum.repliesHeader')}</span>
            <span className="text-right">{t('static.forum.lastActivity')}</span>
          </div>

          {topics.isLoading ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="size-5 animate-spin text-brand-orange" /> {t('content.loading')}
            </p>
          ) : topics.isError ? (
            <p role="alert" className="py-16 text-center text-sm text-gray-500">
              {errorMessage(topics.error)}
            </p>
          ) : !topics.data?.results.length ? (
            <div className="py-16 text-center">
              <MessageSquare className="mx-auto size-10 text-brand-green/30" />
              <p className="mt-3 text-gray-500">{q ? t('content.forum.noResults', { q }) : t('content.forum.empty')}</p>
            </div>
          ) : (
            <ul className={`mt-2 divide-y divide-brand-green/10 sm:mt-0 dark:divide-white/10 ${topics.isPlaceholderData ? 'opacity-60' : ''}`}>
              {topics.data.results.map((tp) => {
                const replies = Math.max(0, tp.post_count)
                return (
                  <li key={tp.id}>
                    <Link
                      to={`/forum/${tp.id}`}
                      className="grid gap-2 rounded-2xl px-5 py-5 transition hover:bg-brand-mist sm:grid-cols-[1fr_7rem_9rem] sm:items-center sm:gap-4 dark:hover:bg-night-card"
                    >
                      <div className="min-w-0">
                        <p className="flex items-start gap-2 font-medium text-brand-graphite dark:text-white">
                          {tp.is_pinned && (
                            <span className="status-pending mt-0.5 shrink-0 gap-1">
                              <Pin className="size-3" /> {t('static.forum.pinned')}
                            </span>
                          )}
                          {tp.is_locked && <Lock className="mt-1 size-3.5 shrink-0 text-gray-400" aria-label={t('content.forum.locked')} />}
                          <span className="break-words">{tp.title}</span>
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {t('static.forum.by', { author: tp.author.name })}
                          {!category && <> · {tp.category.name}</>}
                        </p>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-gray-500 sm:justify-end">
                        <MessageSquare className="size-3.5 sm:hidden" />
                        <span className="sm:hidden">{t('static.forum.replies', { count: replies })}</span>
                        <span className="hidden font-semibold text-brand-graphite sm:inline dark:text-white">{replies}</span>
                      </p>
                      <p className="text-sm text-gray-500 sm:text-right">{ago(tp.last_post_at ?? tp.created_at)}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {pages > 1 && <Pager page={page} pages={pages} onPage={(p) => setParam({ page: p > 1 ? String(p) : null })} />}
        </section>
      </div>
    </>
  )
}

/** Pagination simple : précédent, page courante, suivant */
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('content.forum.pagination')} className="mt-8 flex items-center justify-center gap-3">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('common.previous')} className="btn-secondary rounded-full p-2.5 disabled:opacity-40">
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-sm text-gray-500">{t('content.forum.pageOf', { page, pages })}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label={t('common.next')} className="btn-secondary rounded-full p-2.5 disabled:opacity-40">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}

interface TopicForm {
  category: string
  title: string
  body: string
}

/** Nouveau sujet (artistes connectés) ; après publication, on ouvre le sujet */
function NewTopicForm({ categories, defaultCategory, onClose }: { categories: ForumCategory[]; defaultCategory: string; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<TopicForm>({ category: defaultCategory || categories[0]?.slug || '', title: '', body: '' })
  const [errors, setErrors] = useState<Partial<TopicForm>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const update = (key: keyof TopicForm) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found: Partial<TopicForm> = {}
    if (!form.category) found.category = 'errors.required'
    if (form.title.trim().length < 5) found.title = 'content.forum.errors.title'
    if (form.body.trim().length < 10) found.body = 'content.forum.errors.body'
    setErrors(found)
    if (Object.keys(found).length) return
    setSending(true)
    setFormError(null)
    try {
      const topic = await createTopic({ category: form.category, title: form.title.trim(), body: form.body.trim() })
      void queryClient.invalidateQueries({ queryKey: ['forum'] })
      navigate(`/forum/${topic.id}`)
    } catch (err) {
      const fields = apiFieldErrors(err)
      setErrors(fields)
      if (!Object.keys(fields).length) setFormError(errorMessage(err))
      setSending(false)
    }
  }

  return (
    <form
      id="forum-new"
      noValidate
      onSubmit={onSubmit}
      className="mt-6 grid scroll-mt-28 gap-5 rounded-3xl border border-brand-green/10 bg-white p-6 shadow-[0_30px_70px_-50px_rgb(30_46_41/0.5)] sm:p-8 dark:border-white/10 dark:bg-night-card"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-light tracking-tight text-brand-graphite dark:text-white">{t('static.forum.publish')}</h3>
        <button type="button" onClick={onClose} aria-label={t('content.close')} className="grid size-9 place-items-center rounded-full hover:bg-brand-mist dark:hover:bg-night-field">
          <X className="size-4" />
        </button>
      </div>
      <Field id="topic-category" label={t('content.forum.category')} error={errors.category}>
        <select id="topic-category" value={form.category} onChange={update('category')} className={inputClass(!!errors.category)}>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="topic-title" label={t('content.forum.titleLabel')} error={errors.title}>
        <input id="topic-title" value={form.title} onChange={update('title')} maxLength={200} aria-invalid={!!errors.title} className={inputClass(!!errors.title)} />
      </Field>
      <Field id="topic-body" label={t('content.forum.bodyLabel')} error={errors.body}>
        <textarea id="topic-body" rows={6} value={form.body} onChange={update('body')} aria-invalid={!!errors.body} className={`${inputClass(!!errors.body)} resize-y`} />
      </Field>
      {formError && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {formError}
        </p>
      )}
      <div>
        <button type="submit" disabled={sending} className="btn-primary rounded-full px-6 py-3">
          {sending && <Loader2 className="size-4 animate-spin" />}
          {t('content.forum.submitTopic')}
        </button>
      </div>
    </form>
  )
}
