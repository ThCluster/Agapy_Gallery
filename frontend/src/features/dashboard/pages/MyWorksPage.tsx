import { Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { submitStarted, useDeleteArtwork, useMyArtworks, useMyGallery, useQuote, useSubmitArtwork, useUpdateArtwork, type ArtworkStatus, type MyArtwork } from '@/api/artistSpace'
import { followPaymentAction } from '@/api/payments'
import { errorMessage, toNumber } from '@/lib/api'
import { formatSize } from '@/lib/format'
import { useAuth } from '@/stores/auth'
import { FRAME_SWATCH, FRAMES, type FrameId } from '../frames'
import { PaymentReturnNotice, PayMethods, type PayMethod } from '../PayMethods'
import { formatMoney } from '../revenue'
import { WorkThumb } from '../WorkThumb'

const STATUS_CLASS: Record<ArtworkStatus, string> = {
  draft: 'status-pending',
  awaiting_payment: 'status-pending',
  pending_review: 'status-pending',
  published: 'status-success',
  rejected: 'status-error',
  removed: 'status-error',
}

const SUBMITTABLE: ArtworkStatus[] = ['draft', 'awaiting_payment', 'rejected']
const RETURN_TO = '/tableau-de-bord/oeuvres'

/** Modification des informations d'une œuvre (une œuvre publiée dont le titre ou l'image change repasse en modération). */
function EditWork({ work, onClose }: { work: MyArtwork; onClose: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateArtwork()
  const [title, setTitle] = useState(work.title)
  const [technique, setTechnique] = useState(work.technique)
  const [summary, setSummary] = useState(work.summary)
  const [height, setHeight] = useState(String(work.size[0]))
  const [width, setWidth] = useState(String(work.size[1]))
  const [frame, setFrame] = useState<FrameId>(work.frame)

  const save = (e: FormEvent) => {
    e.preventDefault()
    update.mutate({ slug: work.slug, input: { title, technique, summary, height_cm: height, width_cm: width, frame } }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={save} className="mt-3 grid gap-3 rounded-2xl bg-brand-mist p-4 sm:grid-cols-2 dark:bg-night-field">
      <label className="block sm:col-span-2">
        <span className="text-xs font-medium text-gray-500">{t('dashboard.publish.fields.title')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="field mt-1" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-xs font-medium text-gray-500">{t('dashboard.publish.fields.summary')}</span>
        <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} className="field mt-1" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-xs font-medium text-gray-500">{t('dashboard.publish.fields.technique')}</span>
        <input value={technique} onChange={(e) => setTechnique(e.target.value)} required className="field mt-1" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-500">{t('dashboard.publish.fields.height')}</span>
        <input type="number" min={0.1} step="any" value={height} onChange={(e) => setHeight(e.target.value)} required className="field mt-1" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-500">{t('dashboard.publish.fields.width')}</span>
        <input type="number" min={0.1} step="any" value={width} onChange={(e) => setWidth(e.target.value)} required className="field mt-1" />
      </label>
      <div role="radiogroup" aria-label={t('dashboard.publish.fields.frame')} className="flex flex-wrap gap-2 sm:col-span-2">
        {FRAMES.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={frame === f} onClick={() => setFrame(f)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${frame === f ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/15 hover:border-brand-green/40'}`}>
            <span className={`size-3.5 rounded-sm border ${f === 'none' ? 'border-dashed border-gray-400' : 'border-black/10'}`} style={{ background: FRAME_SWATCH[f] }} />
            {t(`dashboard.frames.${f}`)}
          </button>
        ))}
      </div>
      {work.status === 'published' && <p className="text-xs text-amber-700 sm:col-span-2">{t('dashboard.works.editReview')}</p>}
      {update.isError && <p className="text-sm text-rose-700 sm:col-span-2">{errorMessage(update.error)}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={update.isPending} className="btn-primary rounded-full px-5 py-2 text-sm">
          {update.isPending ? t('dashboard.saving') : t('dashboard.save')}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:underline">
          {t('dashboard.cancel')}
        </button>
      </div>
    </form>
  )
}

/** Soumission à la modération : publication gratuite de l'ouverture, publication déjà réglée, ou paiement. */
function SubmitWork({ work, offered, onClose }: { work: MyArtwork; offered: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const region = useAuth((s) => s.user?.artist?.region)
  const quote = useQuote('publication', region).data
  const submit = useSubmitArtwork()
  const [method, setMethod] = useState<PayMethod>('momo')
  const free = offered || work.publication_settled
  const total = toNumber(quote?.amount_ttc)

  const send = () =>
    submit.mutate(
      { slug: work.slug, method: free ? undefined : method },
      {
        onSuccess: (r) => {
          const started = submitStarted(r)
          if (!started || followPaymentAction(started, RETURN_TO)) onClose()
        },
      },
    )

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-brand-mist p-4 dark:bg-night-field">
      {free ? (
        <p className="text-sm text-brand-green">{offered ? t('signup.payment.freePublication') : t('dashboard.works.settled')}</p>
      ) : (
        <>
          <p className="text-sm">
            {t('dashboard.publish.fee')} : <strong>{quote ? `${formatMoney(total, quote.currency, i18n.resolvedLanguage)} ${t('home.exhibit.ttc')}` : '…'}</strong>
          </p>
          <PayMethods value={method} onChange={setMethod} amount={total} />
        </>
      )}
      {submit.isError && <p className="text-sm text-rose-700">{errorMessage(submit.error, 'method')}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={send} disabled={submit.isPending} className="btn-action rounded-full px-5 py-2 text-sm">
          {submit.isPending ? t('signup.paying') : free ? t('dashboard.publish.submitFree') : t('payment.pay', { amount: formatMoney(total, quote?.currency, i18n.resolvedLanguage) })}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:underline">
          {t('dashboard.cancel')}
        </button>
      </div>
    </div>
  )
}

/** Œuvres de l'artiste : statut de modération, accès gratuit ou payant, modification, soumission, suppression. */
export function MyWorksPage() {
  const { t, i18n } = useTranslation()
  const { data, isPending, isError, error } = useMyArtworks()
  const gallery = useMyGallery().data
  const update = useUpdateArtwork()
  const remove = useDeleteArtwork()
  const [confirm, setConfirm] = useState<string | null>(null)
  const [open, setOpen] = useState<{ slug: string; panel: 'edit' | 'submit' } | null>(null)
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short', year: 'numeric' })
  const works = data?.results ?? []
  const offered = gallery ? !gallery.free_publication_used : false
  const actionError = update.error ?? remove.error

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t('dashboard.nav.works')}</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight">{t('dashboard.works.title', { count: data?.count ?? works.length })}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('dashboard.works.subtitle')}</p>
        </div>
        <Link to="/tableau-de-bord/publier" className="btn-action rounded-full px-5 py-2.5">
          <Plus className="size-4" /> {t('dashboard.nav.publish')}
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        <PaymentReturnNotice />
        {actionError && <p className="text-sm text-rose-700">{errorMessage(actionError)}</p>}
      </div>

      {isPending ? (
        <p className="mt-8 text-sm text-gray-500">{t('dashboard.loading')}</p>
      ) : isError ? (
        <p className="mt-8 text-sm text-rose-700">{errorMessage(error)}</p>
      ) : works.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-brand-mist p-10 text-center dark:bg-night-card">
          <p className="font-semibold text-brand-graphite dark:text-white">{t('dashboard.works.empty')}</p>
          <Link to="/tableau-de-bord/publier" className="btn-primary mt-5 rounded-full px-5">
            {t('dashboard.nav.publish')}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {works.map((w) => (
            <li key={w.slug} className="rounded-2xl border border-brand-green/10 bg-white p-4 dark:border-white/10 dark:bg-night-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <WorkThumb work={w} className="h-24 w-20" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-brand-graphite dark:text-white">{w.title}</p>
                    <span className={STATUS_CLASS[w.status]}>{t(`dashboard.works.status.${w.status}`)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {w.technique} · {formatSize(w.size)} · {t('dashboard.works.since', { date: dateFmt.format(new Date(w.created_at)) })}
                  </p>
                  {w.status === 'pending_review' && <p className="mt-1 text-xs text-amber-700">{t('dashboard.works.pendingHint')}</p>}
                  {w.status === 'awaiting_payment' && <p className="mt-1 text-xs text-amber-700">{t('dashboard.works.awaitingHint')}</p>}
                  {(w.status === 'rejected' || w.status === 'removed') && w.moderation_reason && <p className="mt-1 text-xs text-rose-700">{t('dashboard.works.reason', { reason: w.moderation_reason })}</p>}
                </div>

                {/* Œuvre gratuite ou payante : modifiable à tout moment (p. 10) */}
                <label className="flex cursor-pointer items-center gap-3 text-sm text-brand-ink dark:text-slate-300">
                  <span>{w.is_free ? t('artwork.free') : t('dashboard.works.paid')}</span>
                  <span className="relative inline-flex">
                    <input type="checkbox" checked={w.is_free} disabled={w.status === 'removed' || (update.isPending && update.variables?.slug === w.slug)} onChange={(e) => update.mutate({ slug: w.slug, input: { is_free: e.target.checked } })} className="peer sr-only" />
                    <span className="h-6 w-11 rounded-full bg-brand-graphite/20 transition peer-checked:bg-brand-green peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange" />
                    <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </span>
                </label>

                {w.status !== 'removed' && (
                  <span className="flex items-center gap-1">
                    {SUBMITTABLE.includes(w.status) && (
                      <button type="button" onClick={() => setOpen({ slug: w.slug, panel: 'submit' })} className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-brand-mist hover:text-brand-green" aria-label={t('dashboard.works.submit', { title: w.title })} title={t('dashboard.works.submit', { title: w.title })}>
                        <Send className="size-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setOpen({ slug: w.slug, panel: 'edit' })} className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-brand-mist hover:text-brand-green" aria-label={t('dashboard.works.edit', { title: w.title })} title={t('dashboard.works.edit', { title: w.title })}>
                      <Pencil className="size-4" />
                    </button>
                    {confirm === w.slug ? (
                      <span className="flex items-center gap-2">
                        <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(w.slug, { onSettled: () => setConfirm(null) })} className="btn rounded-full bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-700">
                          {t('dashboard.works.confirmDelete')}
                        </button>
                        <button type="button" onClick={() => setConfirm(null)} className="text-xs text-gray-500 hover:underline">
                          {t('dashboard.cancel')}
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirm(w.slug)} className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-rose-50 hover:text-rose-600" aria-label={t('dashboard.works.delete', { title: w.title })}>
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </span>
                )}
              </div>
              {open?.slug === w.slug && open.panel === 'edit' && <EditWork work={w} onClose={() => setOpen(null)} />}
              {open?.slug === w.slug && open.panel === 'submit' && <SubmitWork work={w} offered={offered} onClose={() => setOpen(null)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
