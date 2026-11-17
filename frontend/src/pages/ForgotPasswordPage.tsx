import { zodResolver } from '@hookform/resolvers/zod'
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { Logo } from '@/components/ui/Logo'
import { PASSWORD_RULE } from '@/features/auth/loginSchema'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { PhoneInput } from '@/features/signup/PhoneInput'

const schema = z
  .object({
    phoneCountry: z.string().length(2),
    phone: z.string().trim().min(1, 'login.errors.phoneRequired'),
    code: z.string(),
    next: z.string(),
    confirm: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.phone && !isValidPhoneNumber(d.phone, d.phoneCountry as CountryCode)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'login.errors.phoneInvalid' })
    if (!/^\d{6}$/.test(d.code)) ctx.addIssue({ code: 'custom', path: ['code'], message: 'forgot.errors.code' })
    if (!PASSWORD_RULE.test(d.next)) ctx.addIssue({ code: 'custom', path: ['next'], message: 'login.errors.passwordFormat' })
    if (d.next !== d.confirm) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'dashboard.profile.errors.mismatch' })
  })
type Form = z.infer<typeof schema>

type Step = 'phone' | 'code' | 'password' | 'done'

/** Mot de passe oublié : numéro de téléphone (login) → code reçu par SMS → nouveau mot de passe. */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('phone')
  const [busy, setBusy] = useState(false)
  const { register, control, trigger, getValues, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { phoneCountry: 'CI', phone: '', code: '', next: '', confirm: '' },
  })
  const phoneCountry = useWatch({ control, name: 'phoneCountry' })
  const err = (k: keyof Form) => formState.errors[k]?.message as string | undefined

  // TODO : chaque étape appellera l'API (envoi du code par SMS, vérification, enregistrement)
  const go = async (fields: (keyof Form)[], next: Step) => {
    if (!(await trigger(fields))) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 900))
    setBusy(false)
    setStep(next)
  }

  const masked = () => {
    const p = parsePhoneNumberFromString(getValues('phone'), getValues('phoneCountry') as CountryCode)
    const n = p?.formatInternational() ?? getValues('phone')
    return n.replace(/\d(?=(?:\D*\d){2})/g, '•')
  }

  return (
    <section className="flex min-h-dvh flex-col bg-[#fafaf8] px-4 py-6 sm:px-10 dark:bg-night-bg">
      <div className="flex items-center justify-between gap-4">
        <Link to="/connexion" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-gray-500 hover:bg-brand-mist hover:text-brand-green dark:hover:bg-night-card">
          <ArrowLeft className="size-4" /> {t('forgot.back')}
        </Link>
        <Link to="/" aria-label={t('header.home')}>
          <Logo className="h-7" />
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-green/10 text-brand-green">
          {step === 'done' ? <CheckCircle2 className="size-7" /> : step === 'code' ? <MessageSquareText className="size-7" /> : <KeyRound className="size-7" />}
        </span>
        <h1 className="mt-6 text-3xl font-light tracking-tight sm:text-4xl">{t(`forgot.${step}.title`)}</h1>
        <p className="mt-2 text-gray-500">{step === 'code' ? t('forgot.code.text', { phone: masked() }) : t(`forgot.${step}.text`)}</p>

        <form
          noValidate
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 'phone') go(['phone'], 'code')
            else if (step === 'code') go(['code'], 'password')
            else if (step === 'password') go(['next', 'confirm'], 'done')
          }}
        >
          {step === 'phone' && (
            <Field id="phone" label={t('login.phone')} error={err('phone')} hint={t('login.phoneHelp')}>
              <PhoneInput id="phone" country={phoneCountry} countryField={register('phoneCountry')} numberField={register('phone')} hasError={!!err('phone')} />
            </Field>
          )}
          {step === 'code' && (
            <Field id="code" label={t('forgot.code.label')} error={err('code')} hint={t('forgot.code.hint')}>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...register('code')} className={`${inputClass(!!err('code'))} text-center font-mono text-2xl tracking-[0.5em]`} placeholder="••••••" />
            </Field>
          )}
          {step === 'password' && (
            <>
              <Field id="next" label={t('dashboard.profile.pwd.next')} error={err('next')} hint={t('login.passwordHelp')}>
                <input id="next" type="password" maxLength={12} autoComplete="new-password" {...register('next')} className={inputClass(!!err('next'))} />
              </Field>
              <Field id="confirm" label={t('dashboard.profile.pwd.confirm')} error={err('confirm')}>
                <input id="confirm" type="password" maxLength={12} autoComplete="new-password" {...register('confirm')} className={inputClass(!!err('confirm'))} />
              </Field>
            </>
          )}

          {step === 'done' ? (
            <Link to="/connexion" className="btn-primary w-full rounded-full py-4 text-base">
              {t('nav.login')}
            </Link>
          ) : (
            <button type="submit" disabled={busy} className="btn-primary w-full rounded-full py-4 text-base">
              {busy && <Loader2 className="size-5 animate-spin" />} {t(`forgot.${step}.submit`)}
            </button>
          )}
          {step === 'code' && (
            <button type="button" onClick={() => go(['phone'], 'code')} className="link w-full text-center text-sm">
              {t('forgot.code.resend')}
            </button>
          )}
        </form>
      </div>
    </section>
  )
}
