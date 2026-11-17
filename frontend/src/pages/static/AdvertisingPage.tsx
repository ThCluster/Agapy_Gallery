import { ArrowRight, CheckCircle2, Clapperboard, Film, Loader2, Play, Radio, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AdSlot } from '@/components/ui/AdSlot'
import { Img } from '@/components/ui/Img'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { formatXOF } from '@/lib/format'
import { CLIP_PRICE_XOF } from '@/lib/pricing'

/** Durée maximale d’un clip sur l’accueil (cahier des charges) */
const MAX_SECONDS = 30

interface Stat {
  value: string
  label: string
}

/** Publicité sur AGAPY : formats proposés et réservation d’un clip vidéo de 30 s sur l’accueil. */
export function AdvertisingPage() {
  const { t } = useTranslation()
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
              <AdSlot format="88x31" />
              <AdSlot format="88x31" />
              <AdSlot format="88x31" />
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
  name: string
  url: string
  seconds: number
}

interface ClipFields {
  title: string
  advertiser: string
  contact: string
  start: string
}
type Errors = Partial<Record<keyof ClipFields, string>>

/** Date du jour au format AAAA-MM-JJ, en heure locale */
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isEmailOrPhone = (value: string) => {
  const v = value.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return true
  return /^\+?[\d\s.()-]+$/.test(v) && v.replace(/\D/g, '').length >= 8
}

/** Réservation d’un clip : la durée de la vidéo est vérifiée dans le navigateur avant tout envoi. */
function ClipForm() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const [today] = useState(todayISO)
  const [fields, setFields] = useState<ClipFields>(() => ({ title: '', advertiser: '', contact: '', start: today }))
  const [errors, setErrors] = useState<Errors>({})
  const [video, setVideo] = useState<Video | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'idle' | 'paying' | 'done'>('idle')
  const [position, setPosition] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  // Numéro de la dernière vérification : ignore le résultat d’une vidéo remplacée entre-temps
  const checkId = useRef(0)

  // Libère l’adresse temporaire de la vidéo quand elle est remplacée ou quand on quitte la page
  useEffect(() => {
    if (!video) return
    return () => URL.revokeObjectURL(video.url)
  }, [video])

  const update = (key: keyof ClipFields) => (e: ChangeEvent<HTMLInputElement>) => {
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
    if (!file.type.startsWith('video/')) {
      rejectVideo(t('static.ads.errors.videoType'))
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
        setVideo({ name: file.name, url, seconds: Math.round(seconds) })
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

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found: Errors = {}
    if (!fields.title.trim()) found.title = 'static.ads.errors.title'
    if (!fields.advertiser.trim()) found.advertiser = 'static.ads.errors.advertiser'
    if (!isEmailOrPhone(fields.contact)) found.contact = 'static.ads.errors.contact'
    if (!fields.start || fields.start < today) found.start = 'static.ads.errors.start'
    setErrors(found)
    const missingVideo = !video && !checking
    if (missingVideo && !videoError) setVideoError(t('static.ads.errors.video'))

    const first = !video ? 'video' : Object.keys(found)[0]
    if (first || checking) {
      if (first) document.getElementById(`clip-${first}`)?.focus()
      return
    }

    setStatus('paying')
    // TODO : envoyer à l'API (téléversement de la vidéo, paiement carte ou mobile money, mise en file d’attente)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // Position simulée dans la file d’attente des clips
    setPosition(Math.floor(Math.random() * 60) + 1)
    setStatus('done')
  }

  const reset = () => {
    setFields({ title: '', advertiser: '', contact: '', start: today })
    setVideo(null)
    setVideoError(null)
    setErrors({})
    setStatus('idle')
    if (fileInput.current) fileInput.current.value = ''
  }

  const price = formatXOF(CLIP_PRICE_XOF.ttc, lng)
  const startValue = new Date(`${fields.start}T00:00`)
  const startDate = Number.isNaN(startValue.getTime())
    ? fields.start
    : new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'long', year: 'numeric' }).format(startValue)

  const input = (key: keyof ClipFields, props: { type?: string; placeholder?: string; autoComplete?: string; min?: string }) => (
    <input
      id={`clip-${key}`}
      type={props.type ?? 'text'}
      value={fields[key]}
      onChange={update(key)}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete}
      min={props.min}
      aria-invalid={!!errors[key]}
      aria-describedby={errors[key] ? `clip-${key}-error` : undefined}
      className={inputClass(!!errors[key])}
    />
  )

  return (
    <section aria-labelledby="clip-form-title" className="rounded-3xl bg-white p-6 shadow-[0_30px_70px_-50px_rgb(30_46_41/0.5)] sm:p-10 dark:bg-night-bg">
      <h3 id="clip-form-title" className="flex items-center gap-3 text-2xl font-light tracking-tight text-brand-graphite dark:text-white">
        <Clapperboard className="size-6 text-brand-orange" /> {t('static.ads.form.title')}
      </h3>

      {status === 'done' ? (
        <div role="status" className="mt-8 rounded-2xl bg-brand-mist p-8 text-center dark:bg-night-card">
          <CheckCircle2 className="mx-auto size-12 text-brand-green dark:text-emerald-400" />
          <p className="mt-4 text-xl font-semibold text-brand-graphite dark:text-white">{t('static.ads.form.successTitle')}</p>
          <p className="mt-2 text-gray-500 dark:text-slate-400">
            {t('static.ads.form.successText', { title: fields.title.trim(), position, date: startDate })}
          </p>
          <button type="button" onClick={reset} className="btn-secondary mt-6 rounded-full px-5 py-2.5">
            {t('static.ads.form.again')}
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="mt-8 grid gap-6 sm:grid-cols-2">
          {/* Vidéo : champ natif masqué, libellé stylé en zone de dépôt */}
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-brand-graphite dark:text-white">{t('static.ads.form.video')}</p>
            <input
              ref={fileInput}
              id="clip-video"
              type="file"
              accept="video/*"
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
          <Field id="clip-start" label={t('static.ads.form.start')} error={errors.start} className="sm:col-span-2">
            {input('start', { type: 'date', min: today })}
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
