import { Building2, Check, CreditCard, ImagePlus, Landmark, Loader2, LocateFixed, Smartphone, User, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AFRICA, countryName, OTHERS } from '@/features/auth/countries'
import { formatPrice, PRICES, VAT_RATE, withVat } from '@/lib/pricing'
import { Field } from './Field'
import { inputClass } from './inputClass'
import { PhoneInput } from './PhoneInput'
import { MOMO_OPERATORS, regionOf, type SignupForm } from './schema'

/** Date du jour (AAAA-MM-JJ), pour interdire les dates dans le futur */
const TODAY = new Date().toISOString().slice(0, 10)

function useSignupForm() {
  const form = useFormContext<SignupForm>()
  const err = (name: keyof SignupForm) => form.formState.errors[name]?.message as string | undefined
  return { ...form, err }
}

/** Titre d'étape */
function StepTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{title}</h2>
      {text && <p className="mt-2 text-gray-500">{text}</p>}
    </div>
  )
}

/* ───────────── Étape 1 : civilité ───────────── */
export function StepCivility() {
  const { t } = useTranslation()
  const { setValue, control, err } = useSignupForm()
  const civility = useWatch({ control, name: 'civility' })
  const choices = [
    { value: 'mr', icon: User },
    { value: 'mrs', icon: UserRound },
    { value: 'org', icon: Building2 },
  ] as const

  return (
    <>
      <StepTitle title={t('signup.civility.title')} text={t('signup.civility.text')} />
      <div role="radiogroup" aria-label={t('signup.civility.title')} className="grid gap-4 sm:grid-cols-3">
        {choices.map(({ value, icon: Icon }) => {
          const active = civility === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setValue('civility', value, { shouldValidate: true })}
              className={`group relative flex flex-col items-start rounded-3xl border p-6 text-left transition ${
                active ? 'border-brand-green bg-brand-green/[0.04] ring-2 ring-brand-green' : 'border-brand-graphite/10 hover:-translate-y-0.5 hover:border-brand-green/40 hover:shadow-lg dark:border-white/10'
              }`}
            >
              <span className={`grid size-12 place-items-center rounded-2xl ${active ? 'bg-brand-green text-white' : 'bg-brand-mist text-brand-green dark:bg-night-field'}`}>
                <Icon className="size-6" />
              </span>
              <span className="mt-5 text-lg font-semibold text-brand-graphite dark:text-white">{t(`signup.civility.${value}`)}</span>
              <span className="mt-1 text-sm text-gray-500">{t(`signup.civility.${value}Hint`)}</span>
              {active && (
                <span className="absolute top-4 right-4 grid size-6 place-items-center rounded-full bg-brand-green text-white">
                  <Check className="size-4" />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {err('civility') && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {t(err('civility')!)}
        </p>
      )}
    </>
  )
}

/* ───────────── Étape 2 : identité ───────────── */
export function StepIdentity() {
  const { t } = useTranslation()
  const { register, control, err } = useSignupForm()
  const civility = useWatch({ control, name: 'civility' })

  if (civility === 'org') {
    return (
      <>
        <StepTitle title={t('signup.identity.orgTitle')} text={t('signup.identity.orgText')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="orgName" label={t('signup.fields.orgName')} error={err('orgName')} className="sm:col-span-2">
            <input id="orgName" {...register('orgName')} className={inputClass(!!err('orgName'))} autoComplete="organization" />
          </Field>
          <Field id="foundedDate" label={t('signup.fields.foundedDate')} error={err('foundedDate')}>
            <input id="foundedDate" type="date" max={TODAY} {...register('foundedDate')} className={inputClass(!!err('foundedDate'))} />
          </Field>
          <Field id="foundedPlace" label={t('signup.fields.foundedPlace')} error={err('foundedPlace')}>
            <input id="foundedPlace" {...register('foundedPlace')} className={inputClass(!!err('foundedPlace'))} />
          </Field>
        </div>
      </>
    )
  }

  return (
    <>
      <StepTitle title={t('signup.identity.title')} text={t('signup.identity.text')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="lastName" label={t('signup.fields.lastName')} error={err('lastName')}>
          <input id="lastName" {...register('lastName')} className={inputClass(!!err('lastName'))} autoComplete="family-name" />
        </Field>
        <Field id="firstNames" label={t('signup.fields.firstNames')} error={err('firstNames')}>
          <input id="firstNames" {...register('firstNames')} className={inputClass(!!err('firstNames'))} autoComplete="given-name" />
        </Field>
        <Field id="birthDate" label={t('signup.fields.birthDate')} error={err('birthDate')}>
          <input id="birthDate" type="date" max={TODAY} {...register('birthDate')} className={inputClass(!!err('birthDate'))} autoComplete="bday" />
        </Field>
        <Field id="birthPlace" label={t('signup.fields.birthPlace')} error={err('birthPlace')}>
          <input id="birthPlace" {...register('birthPlace')} className={inputClass(!!err('birthPlace'))} />
        </Field>
        <Field id="artistName" label={t('signup.fields.artistName')} error={err('artistName')} hint={t('signup.fields.artistNameHint')} className="sm:col-span-2">
          <input id="artistName" {...register('artistName')} className={inputClass(!!err('artistName'))} />
        </Field>
      </div>
    </>
  )
}

/* ───────────── Étape 3 : coordonnées ───────────── */
export function StepContact() {
  const { t, i18n } = useTranslation()
  const { register, control, setValue, err } = useSignupForm()
  const [phoneCountry, civility, photo] = useWatch({ control, name: ['phoneCountry', 'civility', 'photo'] })
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState(false)
  const lng = i18n.resolvedLanguage ?? 'fr'

  // Aperçu de la photo choisie (l'adresse temporaire est libérée quand la photo change)
  const file = photo?.[0]
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const locate = () => {
    if (!navigator.geolocation) return setGpsError(true)
    setLocating(true)
    setGpsError(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue('gps', `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`, { shouldValidate: true })
        setLocating(false)
      },
      () => {
        setGpsError(true)
        setLocating(false)
      },
      { timeout: 10000 },
    )
  }

  return (
    <>
      <StepTitle title={t('signup.contact.title')} text={t('signup.contact.text')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" label={t('signup.fields.phone')} error={err('phone')} hint={t('signup.fields.phoneHint')} className="sm:col-span-2">
          <PhoneInput id="phone" country={phoneCountry} countryField={register('phoneCountry')} numberField={register('phone')} hasError={!!err('phone')} />
        </Field>
        <Field id="email" label={t('signup.fields.email')} error={err('email')} hint={t('signup.fields.emailHint')} className="sm:col-span-2">
          <input id="email" type="email" autoComplete="email" {...register('email')} className={inputClass(!!err('email'))} placeholder="nom@exemple.com" />
        </Field>

        <Field id="country" label={t('signup.fields.country')} error={err('country')}>
          <select id="country" {...register('country')} className={inputClass(!!err('country'))}>
            <optgroup label={t('login.africa')}>
              {AFRICA.map((c) => (
                <option key={c} value={c}>
                  {countryName(c, lng)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('login.otherCountries')}>
              {OTHERS.map((c) => (
                <option key={c} value={c}>
                  {countryName(c, lng)}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field id="city" label={civility === 'org' ? t('signup.fields.commune') : t('signup.fields.city')} error={err('city')}>
          <input id="city" {...register('city')} className={inputClass(!!err('city'))} autoComplete="address-level2" />
        </Field>
        <Field id="village" label={t('signup.fields.village')} optional error={err('village')}>
          <input id="village" {...register('village')} className={inputClass(!!err('village'))} />
        </Field>
        <Field id="gps" label={t('signup.fields.gps')} optional error={err('gps') ?? (gpsError ? 'signup.errors.gpsUnavailable' : undefined)}>
          <div className="flex gap-2">
            <input id="gps" {...register('gps')} placeholder="5.36000, -4.00830" className={inputClass(!!err('gps'))} />
            <button type="button" onClick={locate} className="btn-secondary shrink-0 rounded-2xl px-3" title={t('signup.fields.gpsLocate')} aria-label={t('signup.fields.gpsLocate')}>
              {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
            </button>
          </div>
        </Field>

        {/* Photo de l'artiste ou logo de la fondation */}
        <Field id="photo" label={civility === 'org' ? t('signup.fields.logo') : t('signup.fields.photo')} error={err('photo')} hint={t('signup.fields.photoHint')} className="sm:col-span-2">
          <label
            htmlFor="photo"
            className={`flex cursor-pointer items-center gap-5 rounded-2xl border border-dashed p-4 transition hover:border-brand-green hover:bg-brand-mist dark:hover:bg-night-field ${
              err('photo') ? 'border-rose-400' : 'border-brand-graphite/20 dark:border-white/20'
            }`}
          >
            <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-mist text-brand-green dark:bg-night-field">
              {preview && file ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="size-7" />}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-brand-graphite dark:text-white">{file ? file.name : t('signup.fields.photoChoose')}</span>
              <span className="block text-xs text-gray-500">{t('signup.fields.photoFormats')}</span>
            </span>
          </label>
          <input id="photo" type="file" accept="image/*" {...register('photo')} className="sr-only" />
        </Field>

        <div className="space-y-3 sm:col-span-2">
          <p className="text-sm font-medium text-brand-graphite dark:text-white">
            {t('signup.fields.links')} <span className="text-xs font-normal text-gray-400">{t('signup.optional')}</span>
          </p>
          {(['website', 'facebook', 'instagram'] as const).map((k) => (
            <Field key={k} id={k} label={t(`signup.fields.${k}`)} error={err(k)}>
              <input id={k} type="url" inputMode="url" {...register(k)} placeholder="https://" className={inputClass(!!err(k))} />
            </Field>
          ))}
        </div>
      </div>
    </>
  )
}

/* ───────────── Étape 4 : compte de récupération des fonds ───────────── */
export function StepPayout() {
  const { t } = useTranslation()
  const { register, control, setValue, err } = useSignupForm()
  const [payoutMomo, payoutIban, phoneCountry] = useWatch({ control, name: ['payoutMomo', 'payoutIban', 'phoneCountry'] })

  const card = (active: boolean) =>
    `rounded-3xl border p-5 transition ${active ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/10 dark:border-white/10'}`
  const toggle = (name: 'payoutMomo' | 'payoutIban', value: boolean) => setValue(name, value, { shouldValidate: true })

  return (
    <>
      <StepTitle title={t('signup.payout.title')} text={t('signup.payout.text')} />
      <div className="space-y-4">
        {/* Mobile money */}
        <div className={card(payoutMomo)}>
          <label className="flex cursor-pointer items-start gap-4">
            <input type="checkbox" checked={payoutMomo} onChange={(e) => toggle('payoutMomo', e.target.checked)} className="mt-1 size-5 accent-brand-green" />
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold text-brand-graphite dark:text-white">
                <Smartphone className="size-5 text-brand-orange" /> {t('signup.payout.momo')}
                <span className="status-success">{t('signup.payout.recommended')}</span>
              </span>
              <span className="mt-1 block text-sm text-gray-500">{t('signup.payout.momoText')}</span>
            </span>
          </label>
          {payoutMomo && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field id="momoOperator" label={t('signup.fields.operator')} error={err('momoOperator')}>
                <select id="momoOperator" {...register('momoOperator')} className={inputClass(!!err('momoOperator'))}>
                  <option value="">{t('signup.fields.operatorChoose')}</option>
                  {MOMO_OPERATORS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="momoNumber" label={t('signup.fields.momoNumber')} error={err('momoNumber')}>
                <PhoneInput id="momoNumber" country={phoneCountry} countryField={register('phoneCountry')} numberField={register('momoNumber')} hasError={!!err('momoNumber')} />
              </Field>
            </div>
          )}
        </div>

        {/* Compte bancaire */}
        <div className={card(payoutIban)}>
          <label className="flex cursor-pointer items-start gap-4">
            <input type="checkbox" checked={payoutIban} onChange={(e) => toggle('payoutIban', e.target.checked)} className="mt-1 size-5 accent-brand-green" />
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold text-brand-graphite dark:text-white">
                <Landmark className="size-5 text-brand-green" /> {t('signup.payout.bank')}
              </span>
              <span className="mt-1 block text-sm text-gray-500">{t('signup.payout.bankText')}</span>
            </span>
          </label>
          {payoutIban && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field id="accountHolder" label={t('signup.fields.accountHolder')} error={err('accountHolder')}>
                <input id="accountHolder" {...register('accountHolder')} className={inputClass(!!err('accountHolder'))} autoComplete="name" />
              </Field>
              <Field id="bankName" label={t('signup.fields.bankName')} optional error={err('bankName')}>
                <input id="bankName" {...register('bankName')} className={inputClass(!!err('bankName'))} />
              </Field>
              <Field id="iban" label="IBAN" error={err('iban')} hint={t('signup.fields.ibanHint')} className="sm:col-span-2">
                <input id="iban" {...register('iban')} className={`${inputClass(!!err('iban'))} font-mono uppercase`} placeholder="CI93 CI00 0000 0000 0000 0000 000" autoComplete="off" />
              </Field>
            </div>
          )}
        </div>

        {err('payoutMomo') && (
          <p role="alert" className="text-sm text-rose-600">
            {t(err('payoutMomo')!)}
          </p>
        )}
        <p className="text-xs text-gray-500">{t('signup.payout.both')}</p>
      </div>
    </>
  )
}

/* ───────────── Étape 5 : paiement des frais d'ouverture ───────────── */
export function StepPayment() {
  const { t, i18n } = useTranslation()
  const { register, control, setValue, err } = useSignupForm()
  const [country, method] = useWatch({ control, name: ['country', 'paymentMethod'] })
  const lng = i18n.resolvedLanguage
  const region = regionOf(country)
  const fee = PRICES.signup[region]
  const showVat = region === 'africa' // TVA précisée au cahier des charges pour l'Afrique
  const vat = { ...fee, amount: fee.amount * VAT_RATE }
  const total = showVat ? { ...fee, amount: withVat(fee.amount) } : fee

  const methods = [
    { value: 'momo', icon: Smartphone },
    { value: 'card', icon: CreditCard },
  ] as const

  return (
    <>
      <StepTitle title={t('signup.payment.title')} text={t('signup.payment.text')} />

      {/* Facture */}
      <div className="rounded-3xl border border-brand-green/10 bg-gradient-to-br from-white to-brand-mist p-6 dark:border-white/10 dark:from-night-card dark:to-night-field">
        <p className="text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase">{t('signup.payment.invoice')}</p>
        <dl className="mt-4 space-y-3 text-[15px]">
          <div className="flex justify-between gap-4">
            <dt className="text-brand-ink dark:text-slate-300">{t('signup.payment.hosting')}</dt>
            <dd className="font-medium text-brand-graphite dark:text-white">
              {formatPrice(fee, lng)} {t('home.exhibit.ht')}
            </dd>
          </div>
          {showVat && (
            <div className="flex justify-between gap-4">
              <dt className="text-brand-ink dark:text-slate-300">{t('signup.payment.vat')}</dt>
              <dd className="font-medium text-brand-graphite dark:text-white">{formatPrice(vat, lng)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-brand-green dark:text-emerald-400">{t('signup.payment.freePublication')}</dt>
            <dd className="font-medium text-brand-green dark:text-emerald-400">{t('signup.payment.included')}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-brand-graphite/10 pt-4 dark:border-white/10">
            <dt className="font-semibold text-brand-graphite dark:text-white">{t('signup.payment.total')}</dt>
            <dd className="text-3xl font-semibold text-brand-graphite dark:text-white">
              {formatPrice(total, lng)} <span className="text-sm font-normal text-gray-500">{showVat ? t('home.exhibit.ttc') : t('home.exhibit.ht')}</span>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-gray-500">{t(`signup.payment.zone.${region}`, { country: countryName(country, lng ?? 'fr') })}</p>
      </div>

      {/* Moyen de paiement */}
      <p className="mt-8 mb-3 text-sm font-medium text-brand-graphite dark:text-white">{t('signup.payment.method')}</p>
      <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
        {methods.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setValue('paymentMethod', value)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
              method === value ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/10 hover:border-brand-green/40 dark:border-white/10'
            }`}
          >
            <Icon className="size-6 text-brand-green" />
            <span>
              <span className="block font-semibold text-brand-graphite dark:text-white">{t(`signup.payment.${value}`)}</span>
              <span className="block text-xs text-gray-500">{t(`signup.payment.${value}Hint`)}</span>
            </span>
          </button>
        ))}
      </div>

      <label className="mt-8 flex cursor-pointer items-start gap-3 text-sm text-brand-ink dark:text-slate-300">
        <input type="checkbox" {...register('acceptTerms')} className="mt-0.5 size-5 shrink-0 accent-brand-green" aria-invalid={!!err('acceptTerms')} />
        <span>
          {t('signup.payment.termsStart')}{' '}
          <Link to="/conditions-generales" target="_blank" className="link">
            {t('footer.terms')}
          </Link>{' '}
          {t('signup.payment.termsEnd')}
        </span>
      </label>
      {err('acceptTerms') && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {t(err('acceptTerms')!)}
        </p>
      )}
    </>
  )
}
