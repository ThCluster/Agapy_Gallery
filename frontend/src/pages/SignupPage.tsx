import { zodResolver } from '@hookform/resolvers/zod'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { ArrowLeft, ArrowRight, Check, HeartHandshake, Lock, Mail, PartyPopper, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { DEFAULT_VALUES, signupSchema, stepFields, type SignupForm } from '@/features/signup/schema'
import { StepCivility, StepContact, StepIdentity, StepPayment, StepPayout } from '@/features/signup/steps'

const STEPS = ['civility', 'identity', 'contact', 'payout', 'payment'] as const
const DRAFT_KEY = 'agapy-signup-draft'

/** Brouillon enregistré dans le navigateur (hors photo), pour ne rien perdre en cas de rechargement */
function loadDraft(): SignupForm {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) return { ...DEFAULT_VALUES, ...JSON.parse(raw), photo: undefined, acceptTerms: false }
  } catch {
    // stockage indisponible : on repart d'un formulaire vide
  }
  return DEFAULT_VALUES
}

export function SignupPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<string | null>(null)

  const form = useForm<SignupForm>({ resolver: zodResolver(signupSchema), defaultValues: loadDraft(), mode: 'onTouched' })
  const { handleSubmit, trigger, control, subscribe, formState } = form
  const civility = useWatch({ control, name: 'civility' })

  // Sauvegarde automatique du brouillon
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values }) => {
          try {
            const { photo: _photo, acceptTerms: _terms, ...rest } = values
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(rest))
          } catch {
            // stockage indisponible : pas de brouillon
          }
        },
      }),
    [subscribe],
  )

  const goTo = (s: number) => {
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = async () => {
    if (await trigger(stepFields(step, civility), { shouldFocus: true })) goTo(step + 1)
  }

  const onSubmit = async (data: SignupForm) => {
    // TODO : envoyer l'inscription et lancer le paiement (mobile money ou carte) via l'API
    await new Promise((r) => setTimeout(r, 1400))
    const login = parsePhoneNumberFromString(data.phone, data.phoneCountry as CountryCode)?.formatInternational() ?? data.phone
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // rien à nettoyer
    }
    setDone(login)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (done) return <SignupDone login={done} />

  const isLast = step === STEPS.length - 1

  return (
    <div>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:py-16">
        {/* Colonne de progression */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">{t('signup.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight sm:text-4xl">{t('signup.title')}</h1>

          {/* Barre de progression (mobile) */}
          <div className="mt-6 lg:hidden">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{t(`signup.steps.${STEPS[step]}`)}</span>
              <span>
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-mist dark:bg-night-card">
              <div className="h-full rounded-full bg-brand-green transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>

          {/* Étapes (ordinateur) */}
          <ol className="mt-8 hidden space-y-1 lg:block">
            {STEPS.map((s, i) => {
              const state = i < step ? 'done' : i === step ? 'current' : 'todo'
              return (
                <li key={s}>
                  <button
                    type="button"
                    disabled={i > step}
                    onClick={() => goTo(i)}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className="flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition enabled:hover:bg-brand-mist disabled:cursor-default dark:enabled:hover:bg-night-card"
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition ${
                        state === 'done' ? 'bg-brand-green text-white' : state === 'current' ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30' : 'bg-brand-mist text-gray-400 dark:bg-night-card'
                      }`}
                    >
                      {state === 'done' ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span>
                      <span className={`block text-sm font-semibold ${state === 'todo' ? 'text-gray-400' : 'text-brand-graphite dark:text-white'}`}>{t(`signup.steps.${s}`)}</span>
                      <span className="block text-xs text-gray-500">{t(`signup.stepsHint.${s}`)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* Petite œuvre encadrée et promesse */}
          <div className="mt-10 hidden rounded-3xl bg-[#f4f1ec] p-6 lg:block dark:bg-night-card">
            <span className="mx-auto block w-32 border-[6px] border-[#2b2b2b] bg-white p-3 shadow-[0_20px_40px_-20px_rgb(30_30_30/0.5)]">
              <span className="block aspect-[3/4] overflow-hidden">
                <Img photo="art_a12" alt="" className="h-full w-full object-cover" />
              </span>
            </span>
            <p className="mt-5 text-center text-sm text-brand-ink dark:text-slate-300">{t('signup.promise')}</p>
          </div>
        </aside>

        {/* Formulaire */}
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="min-w-0">
            <div className="rounded-[2rem] border border-brand-green/10 bg-white p-6 shadow-[0_40px_100px_-60px_rgb(30_46_41/0.45)] sm:p-10 dark:border-white/10 dark:bg-night-card">
              <div key={step} className="animate-[agapy-fade-in_0.5s_ease-out]">
                {step === 0 && <StepCivility />}
                {step === 1 && <StepIdentity />}
                {step === 2 && <StepContact />}
                {step === 3 && <StepPayout />}
                {step === 4 && <StepPayment />}
              </div>

              <div className="mt-10 flex flex-col-reverse gap-3 border-t border-brand-graphite/10 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                {step > 0 ? (
                  <button type="button" onClick={() => goTo(step - 1)} className="btn-secondary rounded-full px-5 py-3">
                    <ArrowLeft className="size-4" /> {t('signup.back')}
                  </button>
                ) : (
                  <Link to="/connexion" className="link text-sm">
                    {t('signup.haveAccount')}
                  </Link>
                )}
                {isLast ? (
                  <button type="submit" disabled={formState.isSubmitting} className="btn-action rounded-full px-7 py-3.5 text-[15px]">
                    <Lock className="size-4" /> {formState.isSubmitting ? t('signup.paying') : t('signup.pay')}
                  </button>
                ) : (
                  <button type="button" onClick={next} className="btn-primary rounded-full px-7 py-3.5 text-[15px]">
                    {t('signup.next')} <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-gray-500">
              <HeartHandshake className="size-4 shrink-0 text-brand-green" /> {t('signup.assistance')}
            </p>
          </form>
        </FormProvider>
      </section>
    </div>
  )
}

/** Confirmation : identifiants envoyés, Compte d'Avoir créé, première publication offerte */
function SignupDone({ login }: { login: string }) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-brand-green/10 text-brand-green">
        <PartyPopper className="size-9" />
      </span>
      <p className="eyebrow mt-8">{t('signup.done.eyebrow')}</p>
      <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">{t('signup.done.title')}</h1>
      <p className="mt-4 text-gray-500">{t('signup.done.text')}</p>

      <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
        <div className="rounded-3xl border border-brand-green/10 bg-brand-mist p-5 dark:border-white/10 dark:bg-night-card">
          <Mail className="size-5 text-brand-green" />
          <p className="mt-3 text-sm text-gray-500">{t('signup.done.login')}</p>
          <p className="mt-1 text-lg font-semibold text-brand-graphite dark:text-white">{login}</p>
          <p className="mt-2 text-xs text-gray-500">{t('signup.done.credentials')}</p>
        </div>
        <div className="rounded-3xl border border-brand-green/10 bg-brand-mist p-5 dark:border-white/10 dark:bg-night-card">
          <Wallet className="size-5 text-brand-orange" />
          <p className="mt-3 text-sm text-gray-500">{t('signup.done.walletTitle')}</p>
          <p className="mt-1 text-lg font-semibold text-brand-graphite dark:text-white">{t('signup.done.walletState')}</p>
          <p className="mt-2 text-xs text-gray-500">{t('signup.done.walletText')}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link to="/connexion" className="btn-primary rounded-full px-7 py-3.5">
          {t('nav.login')}
        </Link>
        <Link to="/tableau-de-bord" className="btn-secondary rounded-full px-7 py-3.5">
          {t('signup.done.publish')}
        </Link>
      </div>
    </section>
  )
}
