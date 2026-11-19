import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, ImagePlus, Lock, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { submitStarted, useCreateArtwork, useMyGallery, useQuote, useSubmitArtwork, useSubscription } from '@/api/artistSpace'
import { followPaymentAction } from '@/api/payments'
import { ApiError, errorMessage, toNumber } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { FRAME_CLASS, FRAME_SWATCH, FRAMES, type FrameId } from '../frames'
import { PayMethods, type PayMethod } from '../PayMethods'
import { formatMoney } from '../revenue'

const schema = z.object({
  title: z.string().trim().min(1, 'signup.errors.required'),
  summary: z.string().trim().min(30, 'dashboard.publish.errors.summary'),
  discipline: z.enum(['peinture', 'photographie', 'sculpture']),
  technique: z.string().trim().min(1, 'signup.errors.required'),
  height: z.string().refine((v) => Number(v) > 0, 'dashboard.publish.errors.size'),
  width: z.string().refine((v) => Number(v) > 0, 'dashboard.publish.errors.size'),
  authorName: z.string().trim().min(1, 'signup.errors.required'),
  authorContact: z.string().trim().min(1, 'signup.errors.required'),
  copyrightOffice: z.string().trim().min(1, 'signup.errors.required'),
  copyrightContact: z.string().trim().min(1, 'signup.errors.required'),
  file: z.custom<FileList | undefined>().refine((f) => !!f?.[0], 'dashboard.publish.errors.file').refine((f) => !f?.[0] || f[0].type.startsWith('image/'), 'signup.errors.photoType').refine((f) => !f?.[0] || f[0].size <= 10 * 1024 * 1024, 'dashboard.publish.errors.fileSize'),
  frame: z.enum(['black', 'wood', 'gold', 'white', 'none']),
  free: z.boolean(),
  certify: z.boolean().refine((v) => v, 'dashboard.publish.errors.certify'),
})
type PublishForm = z.infer<typeof schema>

type Step = 'form' | 'payment' | 'paying' | 'done'

/** Publier une œuvre (cahier des charges, p. 8-9) : informations, cadre, paiement, puis modération. */
export function PublishPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage
  const phone = useAuth((s) => s.phone)
  const email = useAuth((s) => s.user?.email)
  const me = useAuth((s) => s.user?.artist)
  const artist = { name: me?.display_name ?? '' }
  const subscription = useSubscription().data
  const gallery = useMyGallery()
  const quote = useQuote('publication', me?.region).data
  const create = useCreateArtwork()
  const submitWork = useSubmitArtwork()
  const [step, setStep] = useState<Step>('form')
  const [method, setMethod] = useState<PayMethod>('momo')
  const [error, setError] = useState<string | null>(null)
  const submitted = useRef(false)
  /** Œuvre déjà créée (brouillon) : un nouvel essai ne la recrée pas */
  const createdSlug = useRef<string | null>(null)

  const form = useForm<PublishForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      summary: '',
      discipline: 'peinture',
      technique: '',
      height: '',
      width: '',
      authorName: artist.name,
      authorContact: phone ?? email ?? '',
      copyrightOffice: '',
      copyrightContact: '',
      file: undefined,
      frame: 'black',
      free: false,
      certify: false,
    },
  })
  const { register, control, setValue, handleSubmit, getValues, formState } = form
  const [file, frame, title] = useWatch({ control, name: ['file', 'frame', 'title'] })
  const err = (k: keyof PublishForm) => formState.errors[k]?.message as string | undefined

  // Aperçu de l'image importée (libéré si l'image change ; conservé après publication pour la liste des œuvres)
  const picked = file?.[0]
  const preview = useMemo(() => (picked ? URL.createObjectURL(picked) : null), [picked])
  useEffect(
    () => () => {
      if (preview && !submitted.current) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  // Compte en veille : publication impossible tant que l'abonnement n'est pas renouvelé (p. 8)
  if (subscription?.state === 'standby') {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-900">
        <ShieldAlert className="size-8" />
        <h1 className="mt-4 text-2xl font-semibold">{t('dashboard.publish.blockedTitle')}</h1>
        <p className="mt-2 text-sm">{t('dashboard.publish.blockedText')}</p>
        <Link to="/tableau-de-bord/abonnement" className="btn-action mt-6 rounded-full px-5">
          {t('dashboard.banner.renew')}
        </Link>
      </div>
    )
  }

  const fee = toNumber(quote?.amount_ht)
  const vat = toNumber(quote?.vat)
  const money = (v: number, l?: string) => formatMoney(v, quote?.currency, l)
  const offered = !!gallery.data && !gallery.data.free_publication_used
  const total = offered ? 0 : toNumber(quote?.amount_ttc)

  const publish = async () => {
    setStep('paying')
    setError(null)
    const v = getValues()
    try {
      if (!createdSlug.current) {
        const work = await create.mutateAsync({
          title: v.title,
          summary: v.summary,
          discipline: v.discipline,
          technique: v.technique,
          height_cm: v.height,
          width_cm: v.width,
          image: v.file?.[0],
          frame: v.frame as FrameId,
          is_free: v.free,
          author_name: v.authorName,
          author_contact: v.authorContact,
          copyright_office: v.copyrightOffice,
          copyright_contact: v.copyrightContact,
          owner_certified: v.certify,
        })
        createdSlug.current = work.slug
      }
      const result = await submitWork.mutateAsync({ slug: createdSlug.current, method: offered ? undefined : method })
      submitted.current = true
      const started = submitStarted(result)
      if (started && !followPaymentAction(started, '/tableau-de-bord/oeuvres')) return // redirection vers le paiement
      setStep('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      // Erreur sur un champ du formulaire : retour au formulaire avec le message
      const fields: Record<string, keyof PublishForm> = {
        title: 'title', summary: 'summary', technique: 'technique', height_cm: 'height', width_cm: 'width', image: 'file',
        author_name: 'authorName', author_contact: 'authorContact', copyright_office: 'copyrightOffice', copyright_contact: 'copyrightContact', owner_certified: 'certify',
      }
      const field = e instanceof ApiError ? Object.keys(e.fieldCodes()).find((k) => k in fields) : undefined
      if (field && !createdSlug.current) {
        form.setError(fields[field], { message: errorMessage(e, field) })
        setStep('form')
      } else {
        setError(errorMessage(e, e instanceof ApiError && e.code('method') ? 'method' : 'detail'))
        setStep('payment')
      }
    }
  }

  if (step === 'done') {
    return (
      <div className="rounded-3xl border border-brand-green/10 bg-white p-8 text-center sm:p-12 dark:border-white/10 dark:bg-night-card">
        <CheckCircle2 className="mx-auto size-12 text-brand-green" />
        <h1 className="mt-5 text-3xl font-light tracking-tight">{t('dashboard.publish.doneTitle')}</h1>
        <p className="mx-auto mt-3 max-w-lg text-gray-500">{t('dashboard.publish.doneText', { title })}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/tableau-de-bord/oeuvres" className="btn-primary rounded-full px-6 py-3">
            {t('dashboard.publish.seeWorks')}
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="btn-secondary rounded-full px-6 py-3">
            {t('dashboard.publish.another')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="eyebrow">{t('dashboard.nav.publish')}</p>
      <h1 className="mt-1 text-3xl font-light tracking-tight">{step === 'form' ? t('dashboard.publish.title') : t('dashboard.publish.payTitle')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('dashboard.publish.subtitle')}</p>

      {step === 'form' ? (
        <form onSubmit={handleSubmit(() => setStep('payment'))} noValidate className="mt-8 grid gap-8 xl:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            {/* L'œuvre */}
            <fieldset className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
              <legend className="px-2 text-sm font-semibold text-brand-graphite dark:text-white">{t('dashboard.publish.sections.work')}</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="title" label={t('dashboard.publish.fields.title')} error={err('title')} className="sm:col-span-2">
                  <input id="title" {...register('title')} className={inputClass(!!err('title'))} />
                </Field>
                <Field id="summary" label={t('dashboard.publish.fields.summary')} error={err('summary')} hint={t('dashboard.publish.fields.summaryHint')} className="sm:col-span-2">
                  <textarea id="summary" rows={4} {...register('summary')} className={inputClass(!!err('summary'))} />
                </Field>
                <Field id="discipline" label={t('dashboard.publish.fields.discipline')}>
                  <select id="discipline" {...register('discipline')} className={inputClass()}>
                    {(['peinture', 'photographie', 'sculpture'] as const).map((d) => (
                      <option key={d} value={d}>
                        {t(`discipline.${d}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="technique" label={t('dashboard.publish.fields.technique')} error={err('technique')}>
                  <input id="technique" {...register('technique')} placeholder={t('dashboard.publish.fields.techniqueHint')} className={inputClass(!!err('technique'))} />
                </Field>
                <Field id="height" label={t('dashboard.publish.fields.height')} error={err('height')}>
                  <input id="height" type="number" min={1} inputMode="numeric" {...register('height')} className={inputClass(!!err('height'))} />
                </Field>
                <Field id="width" label={t('dashboard.publish.fields.width')} error={err('width')}>
                  <input id="width" type="number" min={1} inputMode="numeric" {...register('width')} className={inputClass(!!err('width'))} />
                </Field>
              </div>
            </fieldset>

            {/* Auteur et droits */}
            <fieldset className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
              <legend className="px-2 text-sm font-semibold text-brand-graphite dark:text-white">{t('dashboard.publish.sections.rights')}</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="authorName" label={t('dashboard.publish.fields.authorName')} error={err('authorName')}>
                  <input id="authorName" {...register('authorName')} className={inputClass(!!err('authorName'))} />
                </Field>
                <Field id="authorContact" label={t('dashboard.publish.fields.authorContact')} error={err('authorContact')}>
                  <input id="authorContact" {...register('authorContact')} className={inputClass(!!err('authorContact'))} />
                </Field>
                <Field id="copyrightOffice" label={t('dashboard.publish.fields.copyrightOffice')} error={err('copyrightOffice')} hint={t('dashboard.publish.fields.copyrightOfficeHint')}>
                  <input id="copyrightOffice" {...register('copyrightOffice')} className={inputClass(!!err('copyrightOffice'))} />
                </Field>
                <Field id="copyrightContact" label={t('dashboard.publish.fields.copyrightContact')} error={err('copyrightContact')} hint={t('dashboard.publish.fields.copyrightContactHint')}>
                  <input id="copyrightContact" {...register('copyrightContact')} className={inputClass(!!err('copyrightContact'))} />
                </Field>
              </div>
            </fieldset>

            {/* Fichier, cadre, accès */}
            <fieldset className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
              <legend className="px-2 text-sm font-semibold text-brand-graphite dark:text-white">{t('dashboard.publish.sections.presentation')}</legend>
              <Field id="file" label={t('dashboard.publish.fields.file')} error={err('file')} hint={t('dashboard.publish.fields.fileHint')}>
                <label htmlFor="file" className={`flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 hover:border-brand-green hover:bg-brand-mist dark:hover:bg-night-field ${err('file') ? 'border-rose-400' : 'border-brand-graphite/20'}`}>
                  <ImagePlus className="size-7 shrink-0 text-brand-green" />
                  <span className="text-sm">
                    <span className="block font-medium text-brand-graphite dark:text-white">{picked ? picked.name : t('dashboard.publish.fields.fileChoose')}</span>
                    <span className="block text-xs text-gray-500">{t('dashboard.publish.fields.fileFormats')}</span>
                  </span>
                </label>
                <input id="file" type="file" accept="image/*" {...register('file')} className="sr-only" />
              </Field>

              <p className="mt-6 mb-3 text-sm font-medium text-brand-graphite dark:text-white">{t('dashboard.publish.fields.frame')}</p>
              <div role="radiogroup" aria-label={t('dashboard.publish.fields.frame')} className="flex flex-wrap gap-2">
                {FRAMES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={frame === f}
                    onClick={() => setValue('frame', f)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${frame === f ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/15 hover:border-brand-green/40'}`}
                  >
                    <span className={`size-4 rounded-sm border ${f === 'none' ? 'border-dashed border-gray-400' : 'border-black/10'}`} style={{ background: FRAME_SWATCH[f] }} />
                    {t(`dashboard.frames.${f}`)}
                  </button>
                ))}
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-brand-ink dark:text-slate-300">
                <input type="checkbox" {...register('free')} className="mt-0.5 size-5 accent-brand-green" />
                <span>
                  <span className="font-medium">{t('dashboard.publish.fields.free')}</span>
                  <span className="block text-xs text-gray-500">{t('dashboard.publish.fields.freeHint')}</span>
                </span>
              </label>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-mist p-4 text-sm text-brand-ink dark:bg-night-card dark:text-slate-300">
              <input type="checkbox" {...register('certify')} className="mt-0.5 size-5 shrink-0 accent-brand-green" />
              <span>{t('dashboard.publish.fields.certify')}</span>
            </label>
            {err('certify') && <p className="-mt-6 text-xs text-rose-600">{t(err('certify')!)}</p>}

            <button type="submit" className="btn-primary rounded-full px-7 py-3.5">
              {t('signup.next')}
            </button>
          </div>

          {/* Aperçu dans le cadre choisi */}
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-3xl bg-[#f4f1ec] p-8 dark:bg-night-card">
              <p className="text-center text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase">{t('dashboard.publish.preview')}</p>
              <div className="mt-6 flex justify-center">
                <span className={`block shadow-[0_30px_60px_-30px_rgb(30_30_30/0.55)] ${FRAME_CLASS[frame as FrameId]}`}>
                  <span className="grid h-56 w-44 place-items-center overflow-hidden bg-white">
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="size-8 text-gray-300" />}
                  </span>
                </span>
              </div>
              <p className="mt-6 text-center text-sm font-semibold text-brand-graphite dark:text-white">{title || t('dashboard.publish.untitled')}</p>
              <p className="text-center text-xs text-gray-500">{artist.name}</p>
            </div>
          </aside>
        </form>
      ) : (
        <div className="mt-8 max-w-2xl space-y-6">
          <button type="button" onClick={() => setStep('form')} disabled={step === 'paying'} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-green">
            <ArrowLeft className="size-4" /> {t('signup.back')}
          </button>

          <div className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
            <p className="text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase">{t('signup.payment.invoice')}</p>
            <dl className="mt-4 space-y-3 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt>{t('dashboard.publish.fee')}</dt>
                <dd className={offered ? 'text-gray-400 line-through' : 'font-medium'}>
                  {money(fee, lng)} {t('home.exhibit.ht')}
                </dd>
              </div>
              {!offered && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('signup.payment.vat')}</dt>
                  <dd className="text-gray-500">{money(vat, lng)}</dd>
                </div>
              )}
              {offered && (
                <div className="flex justify-between gap-4 text-brand-green">
                  <dt>{t('signup.payment.freePublication')}</dt>
                  <dd className="font-medium">{t('signup.payment.included')}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4 border-t border-brand-graphite/10 pt-4 dark:border-white/10">
                <dt className="font-semibold">{t('signup.payment.total')}</dt>
                <dd className="text-2xl font-semibold">
                  {money(total, lng)} {!offered && <span className="text-sm font-normal text-gray-500">{t('home.exhibit.ttc')}</span>}
                </dd>
              </div>
            </dl>
          </div>

          {!offered && <PayMethods value={method} onChange={setMethod} amount={total} />}

          <button type="button" onClick={publish} disabled={step === 'paying' || gallery.isPending || (!offered && !quote)} className="btn-action rounded-full px-7 py-3.5">
            <Lock className="size-4" /> {step === 'paying' ? t('signup.paying') : offered ? t('dashboard.publish.submitFree') : t('payment.pay', { amount: money(total, lng) })}
          </button>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <p className="text-xs text-gray-500">{t('dashboard.publish.moderationNote')}</p>
        </div>
      )}
    </div>
  )
}
