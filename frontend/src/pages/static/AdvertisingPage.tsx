import { ArrowRight, CheckCircle2, Clapperboard, Film, Loader2, Play, Radio, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { followPaymentAction, type PaymentMethod } from '@/api/payments'
import { orderClip, useLiveTv, usePaymentStatus } from '@/api/promotions'
import { useSitePage } from '@/api/site'
import { AdSlot } from '@/components/ui/AdSlot'
import { Img } from '@/components/ui/Img'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { errorMessage } from '@/lib/api'
import { formatXOF } from '@/lib/format'
import { CLIP_PRICE_XOF } from '@/lib/pricing'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuth } from '@/stores/auth'
import { apiFieldErrors } from './formErrors'
import { RichText } from './RichText'

/** Durée maximale d’un clip sur l’accueil (cahier des charges) */
const MAX_SECONDS = 30

interface Stat {
  value: string
  label: string
}

/** Publicité sur AGAPY : formats proposés et réservation d’un clip vidéo de 30 s sur l’accueil. */
export function AdvertisingPage() {
  const { t, i18n } = useTranslation()
  useDocumentTitle(`${t('static.ads.titleStart')} ${t('static.ads.titleEnd')}`)
  // Texte de présentation publié depuis l'administration (facultatif)
  const { data: remote } = useSitePage('advertising', i18n.resolvedLanguage)
  const stats = t('static.ads.stats', { returnObjects: true }) as Stat[]
  const rules = t('static.ads.clipsRules', { returnObjects: true }) as string[]
  const f = (key: string) => t(`static.ads.formats.${key}.title`)

  return (
    <>
      {/* En-tête */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow">{t('static.ads.eyebrow')}</p>
            <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight text-brand-graphite sm:text-6xl dark:text-white">
              {t('static.ads.titleStart')} <span className="font-semibold text-brand-green dark:text-emerald-400">{t('static.ads.titleEnd')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-500 dark:text-slate-400">{t('static.ads.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#clip" className="btn-action rounded-full px-6 py-3">
                <Film className="size-4" /> {t('static.ads.ctaClip')}
              </a>
              <Link to="/contact" className="btn-secondary rounded-full px-6 py-3">
                {t('static.ads.ctaQuote')}
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block text-3xl font-semibold text-brand-graphite dark:text-white">{s.value}</span>
                    <span className="text-sm text-gray-500" aria-hidden>
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {/* Aperçu d’un clip diffusé sur l’accueil */}
          <div className="relative" aria-hidden>
            <div className="overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-50px_rgb(30_46_41/0.6)]">
              <Img photo="hero_gallery" alt="" priority className="aspect-video h-full w-full object-cover" />
            </div>
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-16 place-items-center rounded-full bg-white/95 text-brand-orange shadow-xl">
                <Play className="ml-1 size-7 fill-current" />
              </span>
            </span>
            <span className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-graphite shadow-sm">0:30</span>
            <span className="absolute right-4 bottom-4 rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold text-white shadow-sm">24 h</span>
          </div>
        </div>
      </section>

      {remote && (
        <section className="mx-auto max-w-3xl px-4 pt-20 sm:px-6">
          <RichText text={remote.body} className="text-lg" />
        </section>
      )}

      {/* Formats */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow">{t('static.ads.formatsEyebrow')}</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.ads.formatsTitle')}</h2>
          <p className="mt-4 text-gray-500 dark:text-slate-400">{t('static.ads.formatsLead')}</p>
        </div>

        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FormatCard id="skyscraper" className="lg:row-span-2">
            <AdSlot format="160x600" />
          </FormatCard>
          <FormatCard id="banner" className="lg:col-span-2">
            <AdSlot format="468x60" />
          </FormatCard>
          <FormatCard id="billboard">
            <AdSlot format="336x280" />
          </FormatCard>
          <FormatCard id="buttons">
            <div className="flex flex-wrap justify-center gap-3">
              <AdSlot format="88x31" index={0} />
              <AdSlot format="88x31" index={1} />
              <AdSlot format="88x31" index={2} />
            </div>
          </FormatCard>
          <FormatCard id="skin">
            {/* Maquette : la page encadrée par l’habillage de l’annonceur */}
            <div className="flex h-40 w-full max-w-xs gap-2 rounded-xl bg-gradient-to-r from-brand-orange/25 via-white to-brand-orange/25 p-2 dark:via-night-field" aria-hidden>
              <span className="w-8 shrink-0" />
              <span className="flex flex-1 flex-col gap-2 rounded-lg bg-white p-3 shadow-sm dark:bg-night-card">
                <span className="h-2 w-1/2 rounded-full bg-brand-graphite/15 dark:bg-white/20" />
                <span className="h-12 rounded-md bg-brand-mist dark:bg-night-field" />
                <span className="h-2 w-3/4 rounded-full bg-brand-graphite/10 dark:bg-white/10" />
                <span className="h-2 w-2/3 rounded-full bg-brand-graphite/10 dark:bg-white/10" />
              </span>
              <span className="w-8 shrink-0" />
            </div>
          </FormatCard>
          <FormatCard id="city">
            <span className="relative block w-full overflow-hidden rounded-xl">
              <Img photo="villa_v4" alt={f('city')} className="aspect-[4/3] w-full object-cover" />
              <span className="absolute top-1/2 left-1/2 grid h-14 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center border-4 border-white bg-brand-orange/90 text-[10px] font-semibold tracking-[0.2em] text-white uppercase shadow-xl">
                {t('ads.label')}
              </span>
            </span>
          </FormatCard>
          <FormatCard id="tv">
            <span className="relative block w-full overflow-hidden rounded-xl">
              <Img photo="hall_g5" alt={f('tv')} className="aspect-[4/3] w-full object-cover" />
              <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm">
                <span className="size-2 animate-pulse rounded-full bg-rose-600" /> {t('static.ads.live')}
              </span>
              <Radio className="absolute right-3 bottom-3 size-6 text-white drop-shadow" aria-hidden />
            </span>
          </FormatCard>
        </ul>
      </section>

      {/* Clips vidéo */}
      <section id="clip" className="scroll-mt-20 bg-brand-mist py-20 dark:bg-night-card">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">{t('static.ads.clipsEyebrow')}</p>
            <h2 className="mt-2 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.ads.clipsTitle')}</h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-slate-400">{t('static.ads.clipsLead')}</p>
            <ul className="mt-8 space-y-4">
              {rules.map((r) => (
                <li key={r} className="flex gap-3 leading-relaxed text-brand-ink dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-green dark:text-emerald-400" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <ClipForm />
        </div>
      </section>

      <LiveTvBlock />

      {/* Devis sur mesure */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-[2rem] bg-[#f4f1ec] p-8 sm:p-12 md:flex-row md:items-center md:justify-between dark:bg-night-card">
          <div className="max-w-xl">
            <h2 className="text-3xl font-light tracking-tight text-brand-graphite dark:text-white">{t('static.ads.quoteTitle')}</h2>
            <p className="mt-3 leading-relaxed text-gray-500 dark:text-slate-400">{t('static.ads.quoteText')}</p>
          </div>
          <Link to="/contact" className="btn-primary shrink-0 rounded-full px-6 py-3">
            {t('static.ads.ctaQuote')} <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  )
}

/** Carte d’un format publicitaire, avec son aperçu */
function FormatCard({ id, className = '', children }: { id: string; className?: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <li className={className}>
      <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-green/10 bg-white dark:border-white/10 dark:bg-night-card">
        <div className="flex flex-1 items-center justify-center bg-[#f4f1ec] p-6 dark:bg-night-field">
          <span className="sr-only">{t('static.ads.preview')}</span>
          {children}
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-brand-graphite dark:text-white">{t(`static.ads.formats.${id}.title`)}</h3>
            <span className="text-xs font-semibold tracking-[0.15em] text-brand-orange uppercase">{t(`static.ads.formats.${id}.size`)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-slate-400">{t(`static.ads.formats.${id}.text`)}</p>
        </div>
      </article>
    </li>
  )
}

interface Video {
  file: File
  name: string
  url: string
  seconds: number
}

interface ClipFields {
  title: string
  advertiser: string
  contact: string
  method: PaymentMethod
}
type Errors = Partial<Record<keyof ClipFields | 'poster', string>>

const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_POSTER_BYTES = 5 * 1024 * 1024
const EMPTY: ClipFields = { title: '', advertiser: '', contact: '', method: 'momo' }

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
const isPhone = (v: string) => /^\+?[\d\s.()-]+$/.test(v.trim()) && v.replace(/\D/g, '').length >= 8

/**
 * Commande d’un clip : la durée de la vidéo est lue dans le navigateur avant l’envoi
 * (POST /promotions/clips/, multipart), puis le paiement suit l’action renvoyée par l’API.
 */
function ClipForm() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const authenticated = useAuth((s) => s.status === 'authenticated')
  const [params, setParams] = useSearchParams()
  const [fields, setFields] = useState<ClipFields>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [video, setVideo] = useState<Video | null>(null)
  const [poster, setPoster] = useState<File | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'idle' | 'paying' | 'done'>('idle')
  const [position, setPosition] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Numéro de la dernière vérification : ignore le résultat d’une vidéo remplacée entre-temps
  const checkId = useRef(0)

  // Retour de la page de paiement (?payment=<référence>) : statut réel lu auprès de l'API
  const returnRef = params.get('payment')
  const payment = usePaymentStatus(returnRef)
  const returned = returnRef ? (payment.isError ? 'failed' : (payment.data?.status ?? 'pending')) : null

  // Libère l’adresse temporaire de la vidéo quand elle est remplacée ou quand on quitte la page
  useEffect(() => {
    if (!video) return
    return () => URL.revokeObjectURL(video.url)
  }, [video])

  // Au retour du paiement, on fait défiler jusqu’au formulaire
  useEffect(() => {
    if (returned) document.getElementById('clip')?.scrollIntoView()
  }, [returned])

  const update = (key: keyof ClipFields) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const rejectVideo = (message: string) => {
    setVideo(null)
    setVideoError(message)
    if (fileInput.current) fileInput.current.value = ''
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const id = ++checkId.current
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'mp4' && ext !== 'webm') {
      rejectVideo(t('errors.video_format'))
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      rejectVideo(t('content.clip.videoSize'))
      return
    }
    setVideoError(null)
    setChecking(true)

    // Lecture des seules métadonnées dans un lecteur vidéo invisible
    const url = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.muted = true
    const done = () => {
      probe.removeAttribute('src')
      probe.load()
    }
    probe.onloadedmetadata = () => {
      const seconds = probe.duration
      done()
      if (id !== checkId.current) {
        URL.revokeObjectURL(url)
        return
      }
      setChecking(false)
      if (!Number.isFinite(seconds) || seconds <= 0) {
        URL.revokeObjectURL(url)
        rejectVideo(t('static.ads.errors.videoUnreadable'))
      } else if (seconds > MAX_SECONDS + 0.05) {
        // Petite tolérance : un clip de « 30 s » mesure souvent 30,02 s
        URL.revokeObjectURL(url)
        rejectVideo(t('static.ads.errors.videoTooLong', { seconds: Math.round(seconds) }))
      } else {
        setVideo({ file, name: file.name, url, seconds: Math.min(MAX_SECONDS, Math.max(1, Math.round(seconds))) })
      }
    }
    probe.onerror = () => {
      done()
      URL.revokeObjectURL(url)
      if (id !== checkId.current) return
      setChecking(false)
      rejectVideo(t('static.ads.errors.videoUnreadable'))
    }
    probe.src = url
  }

  const onPoster = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && (!file.type.startsWith('image/') || file.size > MAX_POSTER_BYTES)) {
      setPoster(null)
      setErrors((er) => ({ ...er, poster: 'content.clip.posterInvalid' }))
      e.target.value = ''
      return
    }
    setPoster(file)
    setErrors((er) => ({ ...er, poster: undefined }))
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found: Errors = {}
    if (!fields.title.trim()) found.title = 'static.ads.errors.title'
    if (!fields.advertiser.trim()) found.advertiser = 'static.ads.errors.advertiser'
    if (!isEmail(fields.contact) && !isPhone(fields.contact)) found.contact = 'static.ads.errors.contact'
    if (errors.poster) found.poster = errors.poster
    setErrors(found)
    if (!video && !checking && !videoError) setVideoError(t('static.ads.errors.video'))

    const first = !video ? 'video' : Object.keys(found)[0]
    if (first || checking || !video) {
      if (first) document.getElementById(`clip-${first}`)?.focus()
      return
    }

    setStatus('paying')
    setFormError(null)
    const contact = fields.contact.trim()
    try {
      const started = await orderClip({
        title: fields.title.trim(),
        advertiser: fields.advertiser.trim(),
        ...(isEmail(contact) ? { contact_email: contact } : { contact_phone: contact }),
        video: video.file,
        poster: poster ?? undefined,
        duration_seconds: video.seconds,
        method: fields.method,
      })
      if (followPaymentAction(started, '/publicite')) {
        setPosition(started.clip.queue_position)
        setStatus('done')
      }
      // Sinon : redirection vers la page de paiement, puis retour sur /publicite?payment=…&status=…
    } catch (err) {
      const { video: vErr, duration_seconds: dErr, ...rest } = apiFieldErrors(err, { contact_phone: 'contact', contact_email: 'contact' })
      setErrors(rest as Errors)
      if (vErr || dErr) setVideoError(t(vErr ?? dErr ?? 'errors.generic'))
      if (!vErr && !dErr && !Object.keys(rest).length) setFormError(errorMessage(err, 'method'))
      setStatus('idle')
    }
  }

  const reset = () => {
    setFields(EMPTY)
    setVideo(null)
    setPoster(null)
    setVideoError(null)
    setFormError(null)
    setErrors({})
    setPosition(null)
    setStatus('idle')
    if (fileInput.current) fileInput.current.value = ''
    if (returnRef) {
      const next = new URLSearchParams(params)
      next.delete('payment')
      next.delete('status')
      setParams(next, { replace: true })
    }
  }

  const price = formatXOF(CLIP_PRICE_XOF.ttc, lng)
  // Le Compte d’Avoir n’est proposé qu’aux artistes connectés
  const methods: PaymentMethod[] = authenticated ? ['momo', 'card', 'wallet'] : ['momo', 'card']

  const input = (key: 'title' | 'advertiser' | 'contact', props: { placeholder?: string; autoComplete?: string }) => (
    <input
      id={`clip-${key}`}
      type="text"
      value={fields[key]}
      onChange={update(key)}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete}
      aria-invalid={!!errors[key]}
      aria-describedby={errors[key] ? `clip-${key}-error` : undefined}
      className={inputClass(!!errors[key])}
    />
  )

  const success = status === 'done' || returned === 'succeeded'
  const waiting = !success && returned === 'pending' && status === 'idle'
  const failed = !success && !waiting && returned !== null && status === 'idle'

  return (
    <section aria-labelledby="clip-form-title" className="rounded-3xl bg-white p-6 shadow-[0_30px_70px_-50px_rgb(30_46_41/0.5)] sm:p-10 dark:bg-night-bg">
      <h3 id="clip-form-title" className="flex items-center gap-3 text-2xl font-light tracking-tight text-brand-graphite dark:text-white">
        <Clapperboard className="size-6 text-brand-orange" /> {t('static.ads.form.title')}
      </h3>

      {success ? (
        <div role="status" className="mt-8 rounded-2xl bg-brand-mist p-8 text-center dark:bg-night-card">
          <CheckCircle2 className="mx-auto size-12 text-brand-green dark:text-emerald-400" />
          <p className="mt-4 text-xl font-semibold text-brand-graphite dark:text-white">{t('static.ads.form.successTitle')}</p>
          <p className="mt-2 text-gray-500 dark:text-slate-400">
            {position ? t('content.clip.successQueue', { position }) : t('content.clip.successText')}
          </p>
          <button type="button" onClick={reset} className="btn-secondary mt-6 rounded-full px-5 py-2.5">
            {t('static.ads.form.again')}
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="mt-8 grid gap-6 sm:grid-cols-2">
          {waiting && (
            <p role="status" className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:col-span-2 dark:bg-amber-500/10 dark:text-amber-200">
              <Loader2 className="size-4 shrink-0 animate-spin" /> {t('content.clip.paymentPending')}
            </p>
          )}
          {failed && (
            <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2 dark:bg-rose-500/10 dark:text-rose-300">
              {t('content.clip.paymentFailed')}
            </p>
          )}
          {/* Vidéo : champ natif masqué, libellé stylé en zone de dépôt */}
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-brand-graphite dark:text-white">{t('static.ads.form.video')}</p>
            <input
              ref={fileInput}
              id="clip-video"
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              onChange={onFile}
              aria-invalid={!!videoError}
              aria-describedby={videoError ? 'clip-video-error' : 'clip-video-hint'}
              className="peer sr-only"
            />
            <label
              htmlFor="clip-video"
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition peer-focus-visible:border-brand-orange peer-focus-visible:ring-4 peer-focus-visible:ring-brand-orange/10 hover:border-brand-orange/60 ${
                videoError ? 'border-rose-400' : 'border-brand-graphite/15 dark:border-white/15'
              }`}
            >
              {checking ? <Loader2 className="size-7 animate-spin text-brand-orange" /> : <Upload className="size-7 text-brand-orange" />}
              <span className="text-sm font-semibold text-brand-green dark:text-emerald-400">
                {checking ? t('static.ads.form.videoChecking') : video ? t('static.ads.form.videoChange') : t('static.ads.form.videoChoose')}
              </span>
              <span id="clip-video-hint" className="text-xs text-gray-500">
                {t('static.ads.form.videoHint')}
              </span>
            </label>
            {videoError && (
              <p id="clip-video-error" role="alert" className="mt-1.5 text-xs text-rose-600">
                {videoError}
              </p>
            )}
            {video && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-brand-mist p-3 sm:flex-row sm:items-center dark:bg-night-card">
                <video src={video.url} controls muted playsInline className="aspect-video w-full rounded-xl bg-black sm:w-48" aria-label={video.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-graphite dark:text-white">{video.name}</p>
                  <p className="status-success mt-1">{t('static.ads.form.videoOk', { seconds: video.seconds })}</p>
                </div>
              </div>
            )}
          </div>

          <Field id="clip-title" label={t('static.ads.form.clipTitle')} error={errors.title} className="sm:col-span-2">
            {input('title', { placeholder: t('static.ads.form.clipTitlePlaceholder') })}
          </Field>
          <Field id="clip-advertiser" label={t('static.ads.form.advertiser')} error={errors.advertiser}>
            {input('advertiser', { placeholder: t('static.ads.form.advertiserPlaceholder'), autoComplete: 'organization' })}
          </Field>
          <Field id="clip-contact" label={t('static.ads.form.contact')} error={errors.contact}>
            {input('contact', { placeholder: t('static.ads.form.contactPlaceholder'), autoComplete: 'tel' })}
          </Field>
          <Field id="clip-poster" label={t('content.clip.poster')} error={errors.poster} hint={t('content.clip.posterHint')} optional>
            <input
              id="clip-poster"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPoster}
              aria-invalid={!!errors.poster}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-full file:border-0 file:bg-brand-mist file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-green dark:file:bg-night-card dark:file:text-emerald-400"
            />
          </Field>
          <Field id="clip-method" label={t('content.clip.method')} error={errors.method}>
            <select id="clip-method" value={fields.method} onChange={update('method')} className={inputClass(!!errors.method)}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {t(`content.clip.methods.${m}`)}
                </option>
              ))}
            </select>
          </Field>

          {/* Récapitulatif du prix */}
          <div className="rounded-2xl border border-brand-green/10 p-5 sm:col-span-2 dark:border-white/10">
            <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase">{t('static.ads.form.summary')}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t('static.ads.form.duration')}</dt>
                <dd className="text-right text-brand-graphite dark:text-white">{t('static.ads.form.durationValue')}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t('static.ads.form.priceHt')}</dt>
                <dd className="text-right text-brand-graphite dark:text-white">{formatXOF(CLIP_PRICE_XOF.ht, lng)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-brand-green/10 pt-2 dark:border-white/10">
                <dt className="font-semibold text-brand-graphite dark:text-white">{t('static.ads.form.priceTtc')}</dt>
                <dd className="price text-right text-lg">{price}</dd>
              </div>
            </dl>
          </div>

          <div className="sm:col-span-2">
            {formError && (
              <p role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {formError}
              </p>
            )}
            <button type="submit" disabled={status === 'paying' || checking} className="btn-action w-full rounded-full px-6 py-3.5">
              {status === 'paying' && <Loader2 className="size-4 animate-spin" />}
              {status === 'paying' ? t('static.ads.form.paying') : t('static.ads.form.pay', { amount: price })}
            </button>
            <p className="mt-3 text-center text-xs text-gray-500">{t('static.ads.form.secure')}</p>
          </div>
        </form>
      )}
    </section>
  )
}

/** Hôtes dont le lecteur peut être intégré dans la page */
const EMBED_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'player.vimeo.com', 'facebook.com', 'dailymotion.com']

function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Lecteur intégrable : https et hôte de la liste blanche (ou un de ses sous-domaines) */
function isAllowedEmbed(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/** TV en ligne : direct en cours (lecteur intégré) et prochaines émissions */
function LiveTvBlock() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useLiveTv()
  const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const live = data?.live
  const upcoming = data?.upcoming ?? []

  return (
    <section id="tv" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="eyebrow">{t('content.tv.eyebrow')}</p>
        <h2 className="mt-2 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('content.tv.title')}</h2>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-3xl bg-brand-graphite">
          {live ? (
            <>
              <div className="relative aspect-video">
                {isAllowedEmbed(live.embed_url) ? (
                  <iframe
                    src={live.embed_url}
                    title={live.title}
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                ) : (
                  <a href={safeHttpUrl(live.embed_url) ?? '#tv'} target="_blank" rel="noopener noreferrer" className="absolute inset-0 grid place-items-center text-white underline">
                    <span className="flex items-center gap-2">
                      <Play className="size-5" /> {t('content.tv.watch')}
                    </span>
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3 p-5 text-white">
                <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-rose-600">
                  <span className="size-2 animate-pulse rounded-full bg-rose-600" /> {t('static.ads.live')}
                </span>
                <span className="font-semibold">{live.title}</span>
              </div>
            </>
          ) : (
            <div className="grid aspect-video place-items-center p-6 text-center text-white/80">
              {isLoading ? (
                <Loader2 className="size-8 animate-spin text-brand-orange" />
              ) : (
                <span>
                  <Radio className="mx-auto size-10 text-brand-orange" />
                  <span className="mt-3 block">{t('content.tv.offAir')}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
          <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase">{t('content.tv.upcoming')}</p>
          {upcoming.length ? (
            <ul className="mt-4 divide-y divide-brand-green/10 dark:divide-white/10">
              {upcoming.map((s) => (
                <li key={s.id} className="py-3">
                  <p className="font-medium text-brand-graphite dark:text-white">{s.title}</p>
                  {s.starts_at && <p className="text-sm text-gray-500">{fmt.format(new Date(s.starts_at))}</p>}
                  {s.description && <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{s.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">{t('content.tv.none')}</p>
          )}
        </div>
      </div>
    </section>
  )
}
