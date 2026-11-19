import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Flag, Loader2, Lock, MessageSquare, Pin, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { createPost, FORUM_PAGE_SIZE, reportPost, useForumPosts, useForumTopic, type ForumAuthor } from '@/api/forum'
import { inputClass } from '@/features/signup/inputClass'
import { ApiError, errorMessage } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { Pager } from './ForumPage'
import { useAgo } from './useAgo'

/** Un sujet du forum : message d'ouverture, réponses paginées (20 par page), réponse et signalement. */
export function ForumTopicPage() {
  const { t } = useTranslation()
  const { topicId } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const authenticated = useAuth((s) => s.status === 'authenticated')
  const topic = useForumTopic(topicId)
  const posts = useForumPosts(topic.data ? topicId : undefined, page)
  const pages = Math.max(1, Math.ceil((posts.data?.count ?? 0) / FORUM_PAGE_SIZE))

  const back = (
    <Link to="/forum" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-gray-500 hover:bg-brand-mist hover:text-brand-green dark:hover:bg-night-card">
      <ArrowLeft className="size-4" /> {t('content.forum.back')}
    </Link>
  )

  if (topic.isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-32 text-sm text-gray-500">
        <Loader2 className="size-5 animate-spin text-brand-orange" /> {t('content.loading')}
      </p>
    )
  }

  if (!topic.data) {
    const missing = topic.error instanceof ApiError && topic.error.status === 404
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <MessageSquare className="mx-auto size-10 text-brand-green/30" />
        <p role="alert" className="mt-4 text-gray-500">
          {missing ? t('content.forum.notFound') : errorMessage(topic.error)}
        </p>
        <div className="mt-6">{back}</div>
      </div>
    )
  }

  const tp = topic.data
  return (
    <>
      <header className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          {back}
          <p className="eyebrow mt-6">
            <Link to={`/forum?categorie=${encodeURIComponent(tp.category.slug)}`} className="hover:underline">
              {tp.category.name}
            </Link>
          </p>
          <h1 className="mt-3 flex flex-wrap items-center gap-3 text-3xl leading-tight font-light tracking-tight break-words text-brand-graphite sm:text-4xl dark:text-white">
            {tp.is_pinned && <Pin className="size-6 text-brand-orange" aria-label={t('static.forum.pinned')} />}
            {tp.title}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <PostCard author={tp.author} date={tp.created_at} body={tp.body} highlight />

        <h2 className="mt-12 text-xl font-light tracking-tight text-brand-graphite dark:text-white">
          {t('static.forum.replies', { count: posts.data?.count ?? 0 })}
        </h2>

        {posts.isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 className="size-5 animate-spin text-brand-orange" /> {t('content.loading')}
          </p>
        ) : posts.isError ? (
          <p role="alert" className="py-10 text-center text-sm text-gray-500">
            {errorMessage(posts.error)}
          </p>
        ) : !posts.data?.results.length ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('content.forum.noReplies')}</p>
        ) : (
          <ul className={`mt-4 space-y-4 ${posts.isPlaceholderData ? 'opacity-60' : ''}`}>
            {posts.data.results.map((p) => (
              <li key={p.id}>
                <PostCard author={p.author} date={p.created_at} body={p.body} postId={p.id} canReport={authenticated} />
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <Pager
            page={page}
            pages={pages}
            onPage={(n) => {
              const next = new URLSearchParams(params)
              if (n > 1) next.set('page', String(n))
              else next.delete('page')
              setParams(next)
            }}
          />
        )}

        {/* Répondre */}
        <div className="mt-10">
          {tp.is_locked ? (
            <p className="flex items-center gap-2 rounded-2xl bg-brand-mist px-5 py-4 text-sm text-gray-500 dark:bg-night-card">
              <Lock className="size-4 text-brand-orange" /> {t('content.forum.lockedNote')}
            </p>
          ) : authenticated ? (
            <ReplyForm
              topicId={tp.id}
              onPosted={() => {
                // La nouvelle réponse est en dernière page
                const last = Math.max(1, Math.ceil(((posts.data?.count ?? 0) + 1) / FORUM_PAGE_SIZE))
                if (last !== page) setParams({ page: String(last) })
              }}
            />
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-2xl bg-brand-mist p-6 sm:flex-row sm:items-center sm:justify-between dark:bg-night-card">
              <p className="flex items-start gap-2 text-sm text-gray-500 dark:text-slate-400">
                <Lock className="mt-0.5 size-4 shrink-0 text-brand-orange" /> {t('static.forum.postNote')}
              </p>
              <Link to="/connexion" className="btn-action shrink-0 rounded-full px-5 py-2.5">
                {t('content.forum.loginToReply')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PostCard({
  author,
  date,
  body,
  postId,
  canReport,
  highlight,
}: {
  author: ForumAuthor
  date: string
  body: string
  postId?: number
  canReport?: boolean
  highlight?: boolean
}) {
  const { i18n } = useTranslation()
  const ago = useAgo()
  const full = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date))
  return (
    <article
      className={`rounded-3xl border p-6 sm:p-7 ${
        highlight ? 'border-brand-green/15 bg-white shadow-[0_30px_70px_-50px_rgb(30_46_41/0.5)] dark:border-white/10 dark:bg-night-card' : 'border-brand-green/10 bg-white dark:border-white/10 dark:bg-night-card'
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-brand-green/10 text-sm font-semibold text-brand-green uppercase dark:text-emerald-400">
            {author.name.slice(0, 1)}
          </span>
          {author.artist_id ? (
            <Link to={`/artistes/${author.artist_id}`} className="font-medium text-brand-graphite hover:text-brand-green dark:text-white">
              {author.name}
            </Link>
          ) : (
            <span className="font-medium text-brand-graphite dark:text-white">{author.name}</span>
          )}
        </p>
        <time dateTime={date} title={full} className="text-xs text-gray-400">
          {ago(date)}
        </time>
      </header>
      <p className="mt-4 leading-relaxed break-words whitespace-pre-line text-brand-ink dark:text-slate-300">{body}</p>
      {postId !== undefined && canReport && <ReportButton postId={postId} />}
    </article>
  )
}

function ReportButton({ postId }: { postId: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (state === 'done') return <p className="mt-4 text-xs text-brand-green dark:text-emerald-400">{t('content.forum.reported')}</p>

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    setState('sending')
    setError(null)
    try {
      await reportPost(postId, reason.trim())
      setState('done')
    } catch (err) {
      setError(errorMessage(err, 'reason'))
      setState('idle')
    }
  }

  return open ? (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('content.forum.reportReason')}
        aria-label={t('content.forum.reportReason')}
        maxLength={500}
        className={`${inputClass(!!error)} !py-2 text-sm`}
      />
      <button type="submit" disabled={state === 'sending' || !reason.trim()} className="btn-secondary shrink-0 rounded-full px-4 py-2 text-sm">
        {state === 'sending' && <Loader2 className="size-3.5 animate-spin" />}
        {t('content.forum.report')}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-rose-600">
      <Flag className="size-3.5" /> {t('content.forum.report')}
    </button>
  )
}

function ReplyForm({ topicId, onPosted }: { topicId: number; onPosted: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (body.trim().length < 2) {
      setError(t('content.forum.errors.reply'))
      return
    }
    setSending(true)
    setError(null)
    try {
      await createPost(topicId, body.trim())
      setBody('')
      await queryClient.invalidateQueries({ queryKey: ['forum'] })
      onPosted()
    } catch (err) {
      setError(err instanceof ApiError && (err.code() === 'topic_locked' || err.code('body') === 'topic_locked') ? t('content.forum.lockedNote') : errorMessage(err, 'body'))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
      <label htmlFor="reply-body" className="mb-2 block text-sm font-medium text-brand-graphite dark:text-white">
        {t('content.forum.replyLabel')}
      </label>
      <textarea
        id="reply-body"
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? 'reply-error' : undefined}
        className={`${inputClass(!!error)} resize-y`}
      />
      {error && (
        <p id="reply-error" role="alert" className="mt-1.5 text-xs text-rose-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={sending} className="btn-primary mt-4 rounded-full px-6 py-3">
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {t('content.forum.sendReply')}
      </button>
    </form>
  )
}
