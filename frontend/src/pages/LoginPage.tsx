import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ChevronDown, Eye, EyeOff, Loader2, Lock, Phone } from 'lucide-react'
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { ArtShowcase } from '@/features/auth/ArtShowcase'
import { AFRICA, countryName, OTHERS } from '@/features/auth/countries'
import { loginSchema, type LoginForm } from '@/features/auth/loginSchema'
import { useAuth } from '@/stores/auth'

export function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Après connexion : retour à la page demandée (uniquement une adresse interne)
  const back = params.get('retour')
  const target = back && back.startsWith('/') && !back.startsWith('//') ? back : '/tableau-de-bord'
  const login = useAuth((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const lng = i18n.resolvedLanguage ?? 'fr'

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { country: 'CI', phone: '', password: '', remember: true },
  })

  const country = useWatch({ control, name: 'country' }) as CountryCode

  const onSubmit = async (data: LoginForm) => {
    // Identifiant au format international : +225 07 00 00 00 00 → +2250700000000
    const e164 = parsePhoneNumberFromString(data.phone, data.country as CountryCode)?.number ?? data.phone
    await login(e164, data.password)
    navigate(target)
  }

  const option = (code: CountryCode) => (
    <option key={code} value={code}>
      {countryName(code, lng)} (+{getCountryCallingCode(code)})
    </option>
  )

  const fieldWrap = (hasError: boolean) =>
    `flex items-center rounded-2xl border bg-white transition focus-within:border-brand-orange focus-within:ring-4 focus-within:ring-brand-orange/10 dark:bg-night-field ${
      hasError ? 'border-rose-400' : 'border-brand-graphite/15 dark:border-white/15'
    }`

  return (
    <section className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
      {/* La salle d'exposition */}
      <div className="order-2 min-w-0 lg:order-1">
        <ArtShowcase />
      </div>

      {/* Le formulaire */}
      <div className="order-1 flex min-w-0 flex-col px-4 py-6 sm:px-10 lg:order-2">
        {/* Logo et retour à l'accueil, à la place de la barre de navigation */}
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-gray-500 transition hover:bg-brand-mist hover:text-brand-green dark:hover:bg-night-card">
            <ArrowLeft className="size-4" /> {t('login.backHome')}
          </Link>
          <Link to="/" aria-label={t('header.home')}>
            <Logo className="h-7" />
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <p className="eyebrow">{t('login.eyebrow')}</p>
          <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight sm:text-5xl">
            {t('login.titleStart')} <span className="font-semibold text-brand-green dark:text-emerald-400">{t('login.titleEnd')}</span>
          </h1>
          <p className="mt-3 text-gray-500">{t('login.subtitle')}</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-10 space-y-5">
            {/* Identifiant : numéro de téléphone avec indicatif */}
            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-medium text-brand-graphite dark:text-white">
                {t('login.phone')}
              </label>
              <div className={fieldWrap(!!errors.phone)}>
                <label className="relative shrink-0 border-r border-brand-graphite/10 dark:border-white/10">
                  <span className="sr-only">{t('login.country')}</span>
                  <span className="pointer-events-none flex items-center gap-1.5 py-3.5 pr-3 pl-4 text-[15px]" aria-hidden>
                    <span className="rounded-md bg-brand-mist px-1.5 py-0.5 text-[11px] font-semibold text-brand-green dark:bg-night-card dark:text-emerald-400">{country}</span>
                    <span className="text-brand-graphite dark:text-white">+{getCountryCallingCode(country)}</span>
                    <ChevronDown className="size-3.5 text-gray-400" />
                  </span>
                  <select {...register('country')} className="absolute inset-0 cursor-pointer opacity-0">
                    <optgroup label={t('login.africa')}>{AFRICA.map(option)}</optgroup>
                    <optgroup label={t('login.otherCountries')}>{OTHERS.map(option)}</optgroup>
                  </select>
                </label>
                <Phone className="ml-3 size-4 shrink-0 text-gray-400" />
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="07 00 00 00 00"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? 'phone-error' : 'phone-help'}
                  {...register('phone')}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-[15px] text-brand-graphite placeholder:text-gray-400 focus:outline-none dark:text-white"
                />
              </div>
              {errors.phone ? (
                <p id="phone-error" className="mt-1.5 text-xs text-rose-600">
                  {t(errors.phone.message ?? '')}
                </p>
              ) : (
                <p id="phone-help" className="mt-1.5 text-xs text-gray-500">
                  {t('login.phoneHelp')}
                </p>
              )}
            </div>

            {/* Mot de passe */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="password" className="text-sm font-medium text-brand-graphite dark:text-white">
                  {t('login.password')}
                </label>
                <Link to="/mot-de-passe-oublie" className="link text-xs">
                  {t('login.forgot')}
                </Link>
              </div>
              <div className={fieldWrap(!!errors.password)}>
                <Lock className="ml-4 size-4 shrink-0 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  maxLength={12}
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : 'password-help'}
                  {...register('password')}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-[15px] text-brand-graphite placeholder:text-gray-400 focus:outline-none dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="mr-2 grid size-9 place-items-center rounded-full text-gray-500 hover:bg-brand-mist hover:text-brand-green"
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password ? (
                <p id="password-error" className="mt-1.5 text-xs text-rose-600">
                  {t(errors.password.message ?? '')}
                </p>
              ) : (
                <p id="password-help" className="mt-1.5 text-xs text-gray-500">
                  {t('login.passwordHelp')}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-brand-ink dark:text-slate-300">
              <input type="checkbox" {...register('remember')} className="size-4 rounded accent-brand-green" />
              {t('login.remember')}
            </label>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full rounded-full py-4 text-base">
              {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null}
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <div className="mt-10 rounded-2xl border border-brand-green/10 bg-brand-mist p-5 dark:border-white/10 dark:bg-night-card">
            <p className="font-semibold text-brand-graphite dark:text-white">{t('login.noAccount')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('login.noAccountText')}</p>
            <Link to="/inscription" className="btn-account mt-4">
              {t('nav.register')}
            </Link>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-gray-500">{t('login.multiAccount')}</p>
        </div>
      </div>
    </section>
  )
}
