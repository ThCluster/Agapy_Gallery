import { zodResolver } from '@hookform/resolvers/zod'
import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'
import { ArrowLeft, CheckCircle2, CreditCard, Gift, Loader2, Lock, MapPin, ShieldCheck, Smartphone, TrainFront } from 'lucide-react'
import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Img } from '@/components/ui/Img'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { PhoneInput } from '@/features/signup/PhoneInput'
import { MOMO_OPERATORS } from '@/features/signup/schema'
import { DONATION_ARTIST_SHARE, formatPrice, PRICES, useRegion, VAT_RATE, withVat, type Currency, type Region } from '@/lib/pricing'
import { getArtist } from '@/mocks/artistProfiles'

const schema = z
  .object({
    method: z.enum(['momo', 'card']),
    operator: z.string(),
    phoneCountry: z.string().length(2),
    phone: z.string().trim(),
    email: z.string().trim(),
  })
  .superRefine((d, ctx) => {
    if (d.method === 'momo') {
      if (!d.operator) ctx.addIssue({ code: 'custom', path: ['operator'], message: 'signup.errors.required' })
      if (!d.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'signup.errors.required' })
      else if (!isValidPhoneNumber(d.phone, d.phoneCountry as CountryCode)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'signup.errors.phone' })
    }
    if (d.email && !z.email().safeParse(d.email).success) ctx.addIssue({ code: 'custom', path: ['email'], message: 'signup.errors.email' })
  })
type PaymentForm = z.infer<typeof schema>

type Status = 'form' | 'waiting' | 'done'

/** Référence de paiement lisible, ex. AGP-K3F9QZ (à remplacer par celle du prestataire) */
function newReference(): string {
  return `AGP-${Date.now().toString(36).toUpperCase().slice(-6)}`
}

/** Paiement d'une visite et/ou d'un don, sans inscription (le visiteur n'a pas de compte). */
export function PaymentPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage
  const storeRegion = useRegion((s) => s.region)
  const [params] = useSearchParams()
  // Zone transmise par la page de l'artiste : le don y a été choisi dans la devise de cette zone
  const zoneParam = params.get('zone')
  const region: Region = zoneParam === 'africa' || zoneParam === 'europe' || zoneParam === 'world' ? zoneParam : storeRegion
  const [status, setStatus] = useState<Status>('form')
  const [reference, setReference] = useState('')

  const data = getArtist(params.get('artiste') ?? '')
  const wantsVisit = params.get('visite') === '1' && !data?.artist.free
  const donation = Math.max(0, Number(params.get('don')) || 0)

  const form = useForm<PaymentForm>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'momo', operator: '', phoneCountry: 'CI', phone: '', email: '' },
  })
  const { register, control, setValue, handleSubmit, formState } = form
  const [method, phoneCountry] = useWatch({ control, name: ['method', 'phoneCountry'] })
  const err = (k: keyof PaymentForm) => formState.errors[k]?.message as string | undefined

  // Rien à payer, ou artiste inconnu
  if (!data || (!wantsVisit && !donation)) {
    return (
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-light">{t('payment.nothing.title')}</h1>
        <p className="mt-3 text-gray-500">{t('payment.nothing.text')}</p>
        <Link to="/artistes" className="btn-primary mt-8 rounded-full px-6 py-3">
          {t('artist.backToArtists')}
        </Link>
      </section>
    )
  }

  const { artist, profile } = data
  const visitHt = PRICES.visit[region]
  const currency: Currency = visitHt.currency
  const money = (amount: number) => formatPrice({ amount, currency }, lng)
  const showVat = region === 'africa' // TVA précisée au cahier des charges pour l'Afrique
  const visitTotal = wantsVisit ? (showVat ? withVat(visitHt.amount) : visitHt.amount) : 0
  const total = visitTotal + donation

  const onSubmit = async () => {
    // TODO : créer la transaction chez le prestataire de paiement (mobile money : demande de confirmation
    // envoyée sur le téléphone ; carte : redirection vers sa page sécurisée), puis attendre sa confirmation.
    setStatus('waiting')
    await new Promise((r) => setTimeout(r, 2600))
    setReference(newReference())
    setStatus('done')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* ───────────── Récapitulatif (colonne de droite) ───────────── */
  const summary = (
    <div className="overflow-hidden rounded-3xl border border-brand-green/10 bg-white shadow-[0_30px_80px_-50px_rgb(30_46_41/0.5)] dark:border-white/10 dark:bg-night-card">
      <div className="relative h-36 bg-brand-mist">
        <Img photo={profile.villa} alt="" className="h-full w-full object-cover" />
        <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs text-brand-graphite">
          <MapPin className="size-3.5 text-brand-orange" /> {t('artist.address', { n: artist.address })}
        </span>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <span className="block size-12 overflow-hidden rounded-full bg-brand-mist">
            <Img photo={profile.portrait ?? artist.cover} alt="" className="h-full w-full object-cover" />
          </span>
          <div>
            <p className="font-semibold text-brand-graphite dark:text-white">{artist.name}</p>
            <p className="text-xs text-gray-500">
              {t(`discipline.${artist.discipline}`)} · {artist.city}
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          {wantsVisit && (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-ink dark:text-slate-300">{t('payment.summary.visit')}</dt>
                <dd className="font-medium text-brand-graphite dark:text-white">
                  {money(visitHt.amount)} {showVat && <span className="text-xs font-normal text-gray-500">{t('home.exhibit.ht')}</span>}
                </dd>
              </div>
              {showVat && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('signup.payment.vat')}</dt>
                  <dd className="text-gray-500">{money(visitHt.amount * VAT_RATE)}</dd>
                </div>
              )}
            </>
          )}
          {donation > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-brand-ink dark:text-slate-300">
                <Gift className="size-4 text-brand-orange" /> {t('payment.summary.donation')}
              </dt>
              <dd className="font-medium text-brand-graphite dark:text-white">{money(donation)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-brand-graphite/10 pt-4 dark:border-white/10">
            <dt className="font-semibold text-brand-graphite dark:text-white">{t('signup.payment.total')}</dt>
            <dd className="text-2xl font-semibold text-brand-graphite dark:text-white">{money(total)}</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          {wantsVisit && t('payment.summary.visitShare')} {donation > 0 && t('payment.summary.donationShare', { share: Math.round(DONATION_ARTIST_SHARE * 100) })}
        </p>
        {status === 'form' && (
          <Link to={`/artistes/${artist.id}#support`} className="link mt-4 inline-block text-sm">
            {t('payment.summary.edit')}
          </Link>
        )}
      </div>
    </div>
  )

  /* ───────────── Paiement réussi ───────────── */
  if (status === 'done') {
    return (
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <span className="grid size-16 place-items-center rounded-full bg-brand-green/10 text-brand-green">
            <CheckCircle2 className="size-8" />
          </span>
          <p className="eyebrow mt-6">{t('payment.done.eyebrow')}</p>
          <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">{wantsVisit ? t('payment.done.titleVisit') : t('payment.done.titleDonation', { name: artist.name })}</h1>
          <p className="mt-4 max-w-xl text-gray-500">{wantsVisit ? t('payment.done.textVisit', { name: artist.name }) : t('payment.done.textDonation')}</p>
          <p className="mt-6 inline-block rounded-2xl bg-brand-mist px-5 py-3 text-sm dark:bg-night-card">
            {t('payment.done.reference')} <span className="font-mono font-semibold text-brand-graphite dark:text-white">{reference}</span>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {wantsVisit && (
              <Link to={`/ville/${artist.id}`} className="btn-action rounded-full px-6 py-3">
                <TrainFront className="size-5" /> {t('payment.done.enter')}
              </Link>
            )}
            <Link to={`/artistes/${artist.id}`} className="btn-secondary rounded-full px-6 py-3">
              {t('payment.done.backToVilla')}
            </Link>
          </div>
        </div>
        <aside>{summary}</aside>
      </section>
    )
  }

  /* ───────────── Formulaire de paiement ───────────── */
  const methodCard = (active: boolean) =>
    `flex items-center gap-3 rounded-2xl border p-4 text-left transition ${active ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/10 hover:border-brand-green/40 dark:border-white/10'}`

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <Link to={`/artistes/${artist.id}`} className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-brand-green/15 bg-white px-4 py-2 text-sm font-medium text-brand-green hover:bg-brand-mist dark:border-white/10 dark:bg-night-card dark:text-emerald-400">
        <ArrowLeft className="size-4" /> {t('payment.back', { name: artist.name })}
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="min-w-0">
            <p className="eyebrow">{t('payment.eyebrow')}</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight">{t('payment.title')}</h1>
            <p className="mt-2 text-gray-500">{t('payment.subtitle')}</p>

            <div role="radiogroup" aria-label={t('signup.payment.method')} className="mt-8 grid gap-3 sm:grid-cols-2">
              <button type="button" role="radio" aria-checked={method === 'momo'} onClick={() => setValue('method', 'momo')} className={methodCard(method === 'momo')}>
                <Smartphone className="size-6 text-brand-orange" />
                <span>
                  <span className="block font-semibold text-brand-graphite dark:text-white">{t('signup.payment.momo')}</span>
                  <span className="block text-xs text-gray-500">{t('signup.payment.momoHint')}</span>
                </span>
              </button>
              <button type="button" role="radio" aria-checked={method === 'card'} onClick={() => setValue('method', 'card')} className={methodCard(method === 'card')}>
                <CreditCard className="size-6 text-brand-green" />
                <span>
                  <span className="block font-semibold text-brand-graphite dark:text-white">{t('signup.payment.card')}</span>
                  <span className="block text-xs text-gray-500">{t('signup.payment.cardHint')}</span>
                </span>
              </button>
            </div>

            <div className="mt-8 space-y-5">
              {method === 'momo' ? (
                <>
                  <div>
                    <p className="mb-2 text-sm font-medium text-brand-graphite dark:text-white">{t('signup.fields.operator')}</p>
                    <div className="flex flex-wrap gap-2">
                      {MOMO_OPERATORS.slice(0, 4).map((o) => (
                        <label key={o} className="cursor-pointer">
                          <input type="radio" value={o} {...register('operator')} className="peer sr-only" />
                          <span className="block rounded-full border border-brand-graphite/15 px-4 py-2 text-sm transition peer-checked:border-brand-orange peer-checked:bg-brand-orange peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange hover:border-brand-orange dark:border-white/15">
                            {o}
                          </span>
                        </label>
                      ))}
                    </div>
                    {err('operator') && <p className="mt-1.5 text-xs text-rose-600">{t(err('operator')!)}</p>}
                  </div>
                  <Field id="phone" label={t('signup.fields.momoNumber')} error={err('phone')} hint={t('payment.momoHint')}>
                    <PhoneInput id="phone" country={phoneCountry} countryField={register('phoneCountry')} numberField={register('phone')} hasError={!!err('phone')} />
                  </Field>
                </>
              ) : (
                <p className="flex items-start gap-3 rounded-2xl bg-brand-mist p-5 text-sm text-brand-ink dark:bg-night-card dark:text-slate-300">
                  <ShieldCheck className="size-5 shrink-0 text-brand-green" /> {t('payment.cardRedirect')}
                </p>
              )}
              <Field id="email" label={t('payment.email')} optional error={err('email')} hint={t('payment.emailHint')}>
                <input id="email" type="email" autoComplete="email" {...register('email')} placeholder="nom@exemple.com" className={inputClass(!!err('email'))} />
              </Field>
            </div>

            {status === 'waiting' ? (
              <div role="status" className="mt-8 flex items-center gap-4 rounded-2xl border border-brand-orange/30 bg-brand-orange/5 p-5">
                <Loader2 className="size-6 shrink-0 animate-spin text-brand-orange" />
                <span>
                  <span className="block font-semibold text-brand-graphite dark:text-white">{method === 'momo' ? t('payment.waitingMomo') : t('payment.waitingCard')}</span>
                  <span className="block text-sm text-gray-500">{method === 'momo' ? t('payment.waitingMomoText') : t('payment.waitingCardText')}</span>
                </span>
              </div>
            ) : (
              <button type="submit" className="btn-action mt-8 w-full rounded-full py-4 text-base sm:w-auto sm:px-10">
                <Lock className="size-4" /> {t('payment.pay', { amount: money(total) })}
              </button>
            )}
            <p className="mt-4 text-xs text-gray-500">{t('payment.noAccount')}</p>
          </form>
        </FormProvider>

        <aside className="lg:sticky lg:top-28 lg:self-start">{summary}</aside>
      </div>
    </section>
  )
}
