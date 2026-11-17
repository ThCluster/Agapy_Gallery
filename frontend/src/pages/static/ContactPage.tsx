import { CheckCircle2, Clock, Loader2, MapPin, Phone, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'

const SUBJECTS = ['visitor', 'artist', 'advertiser', 'partnership', 'press', 'other'] as const
const PHONE = '+225 25 22 00 86 05'
const MIN_MESSAGE = 20

interface Form {
  name: string
  contact: string
  subject: string
  message: string
}
type Errors = Partial<Record<keyof Form, string>>

const EMPTY: Form = { name: '', contact: '', subject: '', message: '' }

/** E-mail valide, ou numéro de téléphone d’au moins 8 chiffres */
const isEmailOrPhone = (value: string) => {
  const v = value.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return true
  return /^\+?[\d\s.()-]+$/.test(v) && v.replace(/\D/g, '').length >= 8
}

function validate(form: Form): Errors {
  const errors: Errors = {}
  if (!form.name.trim()) errors.name = 'static.contact.errors.name'
  if (!isEmailOrPhone(form.contact)) errors.contact = 'static.contact.errors.contact'
  if (!form.subject) errors.subject = 'static.contact.errors.subject'
  if (form.message.trim().length < MIN_MESSAGE) errors.message = 'static.contact.errors.message'
  return errors
}

/** Page Contact : formulaire « Nous écrire » (simulé) et coordonnées de G’A HOLDING. */
export function ContactPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  const update = (key: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    // L’erreur disparaît dès que l’utilisateur corrige le champ
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(`contact-${first}`)?.focus()
      return
    }
    setStatus('sending')
    // TODO : envoyer à l'API
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setStatus('sent')
  }

  const reset = () => {
    setForm(EMPTY)
    setStatus('idle')
  }

  const describedBy = (key: keyof Form, hint = false) => (errors[key] ? `contact-${key}-error` : hint ? `contact-${key}-hint` : undefined)
  const length = form.message.trim().length

  return (
    <>
      <header className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="eyebrow">{t('static.contact.eyebrow')}</p>
          <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight text-brand-graphite sm:text-6xl dark:text-white">{t('static.contact.title')}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-500 dark:text-slate-400">{t('static.contact.lead')}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Formulaire */}
        <section aria-labelledby="contact-form-title" className="rounded-3xl border border-brand-green/10 bg-white p-6 shadow-[0_30px_70px_-50px_rgb(30_46_41/0.5)] sm:p-10 dark:border-white/10 dark:bg-night-card">
          <h2 id="contact-form-title" className="text-2xl font-light tracking-tight text-brand-graphite dark:text-white">
            {t('static.contact.formTitle')}
          </h2>

          {status === 'sent' ? (
            <div role="status" className="mt-8 rounded-2xl bg-brand-mist p-8 text-center dark:bg-night-field">
              <CheckCircle2 className="mx-auto size-12 text-brand-green dark:text-emerald-400" />
              <p className="mt-4 text-xl font-semibold text-brand-graphite dark:text-white">{t('static.contact.successTitle')}</p>
              <p className="mt-2 text-gray-500 dark:text-slate-400">{t('static.contact.successText', { name: form.name.trim() })}</p>
              <button type="button" onClick={reset} className="btn-secondary mt-6 rounded-full px-5 py-2.5">
                {t('static.contact.again')}
              </button>
            </div>
          ) : (
            <form noValidate onSubmit={onSubmit} className="mt-8 grid gap-6 sm:grid-cols-2">
              <Field id="contact-name" label={t('static.contact.name')} error={errors.name}>
                <input
                  id="contact-name"
                  autoComplete="name"
                  value={form.name}
                  onChange={update('name')}
                  placeholder={t('static.contact.namePlaceholder')}
                  aria-invalid={!!errors.name}
                  aria-describedby={describedBy('name')}
                  className={inputClass(!!errors.name)}
                />
              </Field>
              <Field id="contact-contact" label={t('static.contact.contact')} error={errors.contact} hint={t('static.contact.contactHint')}>
                <input
                  id="contact-contact"
                  autoComplete="email"
                  value={form.contact}
                  onChange={update('contact')}
                  placeholder={t('static.contact.contactPlaceholder')}
                  aria-invalid={!!errors.contact}
                  aria-describedby={describedBy('contact', true)}
                  className={inputClass(!!errors.contact)}
                />
              </Field>
              <Field id="contact-subject" label={t('static.contact.subject')} error={errors.subject} className="sm:col-span-2">
                <select
                  id="contact-subject"
                  value={form.subject}
                  onChange={update('subject')}
                  aria-invalid={!!errors.subject}
                  aria-describedby={describedBy('subject')}
                  className={inputClass(!!errors.subject)}
                >
                  <option value="" disabled>
                    {t('static.contact.subjectPlaceholder')}
                  </option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`static.contact.subjects.${s}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="contact-message"
                label={t('static.contact.message')}
                error={errors.message}
                hint={t('static.contact.messageCount', { count: length })}
                className="sm:col-span-2"
              >
                <textarea
                  id="contact-message"
                  rows={6}
                  value={form.message}
                  onChange={update('message')}
                  placeholder={t('static.contact.messagePlaceholder')}
                  aria-invalid={!!errors.message}
                  aria-describedby={describedBy('message', true)}
                  className={`${inputClass(!!errors.message)} resize-y`}
                />
              </Field>
              <div className="sm:col-span-2">
                <button type="submit" disabled={status === 'sending'} className="btn-primary w-full rounded-full px-6 py-3.5 sm:w-auto">
                  {status === 'sending' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {status === 'sending' ? t('static.contact.sending') : t('static.contact.submit')}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Coordonnées */}
        <aside className="space-y-6">
          <section aria-labelledby="contact-coords" className="rounded-3xl bg-brand-mist p-6 sm:p-8 dark:bg-night-card">
            <h2 id="contact-coords" className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase">
              {t('static.contact.coordsTitle')}
            </h2>
            <p className="mt-4 text-lg font-semibold text-brand-graphite dark:text-white">{t('static.legal.company')}</p>
            <p className="text-sm text-brand-green italic dark:text-emerald-400">{t('static.legal.slogan')}</p>
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex gap-3 text-brand-ink dark:text-slate-300">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-orange" />
                <span>{t('static.legal.address')}</span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand-orange" />
                <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="link">
                  {PHONE}
                </a>
              </li>
            </ul>
            <dl className="mt-6 space-y-2 border-t border-brand-green/10 pt-5 text-xs text-gray-500 dark:border-white/10">
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt>{t('static.legal.capitalLabel')}</dt>
                <dd className="text-brand-ink dark:text-slate-300">{t('static.legal.capital')}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt>{t('static.legal.rccmLabel')}</dt>
                <dd className="text-brand-ink dark:text-slate-300">{t('static.legal.rccm')}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="contact-delay" className="rounded-3xl border border-brand-green/10 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-night-card">
            <span className="grid size-11 place-items-center rounded-full bg-brand-orange/10 text-brand-orange">
              <Clock className="size-5" />
            </span>
            <h2 id="contact-delay" className="mt-4 text-lg font-semibold text-brand-graphite dark:text-white">
              {t('static.contact.responseTitle')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-slate-400">{t('static.contact.responseText')}</p>
          </section>
        </aside>
      </div>
    </>
  )
}
