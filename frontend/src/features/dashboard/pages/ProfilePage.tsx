import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff, Lock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { PASSWORD_RULE } from '@/features/auth/loginSchema'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { isValidIban, MOMO_OPERATORS } from '@/features/signup/schema'
import { getArtist } from '@/mocks/artistProfiles'
import { useArtistSpace } from '@/stores/artistSpace'
import { useAuth } from '@/stores/auth'

/** Bloc de réglages avec son bouton d'enregistrement et un message de confirmation */
function Section({ id, title, text, children, onSave, saved }: { id?: string; title: string; text?: string; children: ReactNode; onSave: () => void; saved: boolean }) {
  const { t } = useTranslation()
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
      <h2 className="text-lg font-semibold text-brand-graphite dark:text-white">{title}</h2>
      {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
      <div className="mt-5">{children}</div>
      <div className="mt-6 flex items-center gap-3">
        <button type="button" onClick={onSave} className="btn-primary rounded-full px-5">
          {t('dashboard.profile.save')}
        </button>
        {saved && (
          <span role="status" className="flex items-center gap-1 text-sm text-emerald-700">
            <Check className="size-4" /> {t('dashboard.profile.saved')}
          </span>
        )}
      </div>
    </section>
  )
}

/** Hook « enregistré » : affiche la confirmation quelques secondes */
function useSaved(): [boolean, () => void] {
  const [saved, setSaved] = useState(false)
  return [
    saved,
    () => {
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    },
  ]
}

/** Date du jour (AAAA-MM-JJ) : la gratuité ne peut pas se terminer dans le passé */
const TODAY = new Date().toISOString().slice(0, 10)

const passwordSchema = z
  .object({
    current: z.string().min(1, 'login.errors.passwordRequired'),
    next: z.string().regex(PASSWORD_RULE, 'login.errors.passwordFormat'),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { path: ['confirm'], message: 'dashboard.profile.errors.mismatch' })
type PasswordForm = z.infer<typeof passwordSchema>

/** Profil : toutes les informations restent modifiables par l'artiste (cahier des charges, p. 17). */
export function ProfilePage() {
  const { t } = useTranslation()
  const { artistId, phone } = useAuth()
  const { galleryFree, galleryFreeUntil, setGallery } = useArtistSpace()
  const { artist, profile } = getArtist(artistId!)!

  // Informations publiques
  const [info, setInfo] = useState({ name: artist.name, bio: profile.bio, city: artist.city, email: 'awa.kone@exemple.com', website: '', instagram: '' })
  const [infoSaved, markInfo] = useSaved()

  // Statut de la galerie
  const [free, setFree] = useState(galleryFree)
  const [until, setUntil] = useState(galleryFreeUntil)
  const [gallerySaved, markGallery] = useSaved()

  // Versements
  const [payout, setPayout] = useState({ operator: 'Orange Money', momo: '07 00 00 00 00', iban: '' })
  const [ibanError, setIbanError] = useState(false)
  const [payoutSaved, markPayout] = useSaved()

  // Mot de passe
  const [show, setShow] = useState(false)
  const pwd = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { current: '', next: '', confirm: '' } })
  const [pwdSaved, markPwd] = useSaved()
  const pwdErr = (k: keyof PasswordForm) => pwd.formState.errors[k]?.message

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t('dashboard.nav.profile')}</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight">{t('dashboard.profile.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.profile.subtitle')}</p>
      </div>

      {/* TODO : chaque « Enregistrer » enverra les modifications à l'API */}
      <Section title={t('dashboard.profile.public')} onSave={markInfo} saved={infoSaved}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="p-name" label={t('signup.fields.artistName')}>
            <input id="p-name" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className={inputClass()} />
          </Field>
          <Field id="p-city" label={t('signup.fields.city')}>
            <input id="p-city" value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} className={inputClass()} />
          </Field>
          <Field id="p-bio" label={t('dashboard.profile.bio')} className="sm:col-span-2">
            <textarea id="p-bio" rows={4} value={info.bio} onChange={(e) => setInfo({ ...info, bio: e.target.value })} className={inputClass()} />
          </Field>
          <Field id="p-phone" label={t('dashboard.profile.login')} hint={t('dashboard.profile.loginHint')}>
            <input id="p-phone" value={phone ?? ''} readOnly className={`${inputClass()} bg-brand-mist text-gray-500`} />
          </Field>
          <Field id="p-email" label={t('signup.fields.email')}>
            <input id="p-email" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} className={inputClass()} />
          </Field>
          <Field id="p-web" label={t('signup.fields.website')} optional>
            <input id="p-web" type="url" value={info.website} onChange={(e) => setInfo({ ...info, website: e.target.value })} placeholder="https://" className={inputClass()} />
          </Field>
          <Field id="p-ig" label={t('signup.fields.instagram')} optional>
            <input id="p-ig" type="url" value={info.instagram} onChange={(e) => setInfo({ ...info, instagram: e.target.value })} placeholder="https://" className={inputClass()} />
          </Field>
        </div>
      </Section>

      {/* Galerie gratuite ou payante, gratuité éventuellement limitée dans le temps (p. 9-10) */}
      <Section id="galerie" title={t('dashboard.profile.gallery')} text={t('dashboard.profile.galleryText')} onSave={() => {
          setGallery(free, free ? until : '')
          markGallery()
        }} saved={gallerySaved}>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={free === v}
              onClick={() => setFree(v)}
              className={`rounded-2xl border p-4 text-left transition ${free === v ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/10 hover:border-brand-green/40 dark:border-white/10'}`}
            >
              <span className="block font-semibold text-brand-graphite dark:text-white">{v ? t('artist.freeGallery') : t('artist.paidGallery')}</span>
              <span className="block text-xs text-gray-500">{v ? t('dashboard.profile.freeHint') : t('dashboard.profile.paidHint')}</span>
            </button>
          ))}
        </div>
        {free && (
          <Field id="p-until" label={t('dashboard.profile.until')} optional hint={t('dashboard.profile.untilHint')} className="mt-5 max-w-xs">
            <input id="p-until" type="date" min={TODAY} value={until} onChange={(e) => setUntil(e.target.value)} className={inputClass()} />
          </Field>
        )}
      </Section>

      {/* Versements : mobile money et/ou IBAN */}
      <Section
        title={t('dashboard.profile.payout')}
        text={t('signup.payout.text')}
        onSave={() => {
          const bad = !!payout.iban && !isValidIban(payout.iban)
          setIbanError(bad)
          if (!bad) markPayout()
        }}
        saved={payoutSaved}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="p-op" label={t('signup.fields.operator')}>
            <select id="p-op" value={payout.operator} onChange={(e) => setPayout({ ...payout, operator: e.target.value })} className={inputClass()}>
              {MOMO_OPERATORS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field id="p-momo" label={t('signup.fields.momoNumber')}>
            <input id="p-momo" type="tel" value={payout.momo} onChange={(e) => setPayout({ ...payout, momo: e.target.value })} className={inputClass()} />
          </Field>
          <Field id="p-iban" label="IBAN" optional error={ibanError ? 'signup.errors.iban' : undefined} className="sm:col-span-2">
            <input id="p-iban" value={payout.iban} onChange={(e) => setPayout({ ...payout, iban: e.target.value })} className={`${inputClass(ibanError)} font-mono uppercase`} />
          </Field>
        </div>
      </Section>

      {/* Mot de passe : modifiable à souhait (p. 15) */}
      <Section
        title={t('dashboard.profile.password')}
        text={t('login.passwordHelp')}
        onSave={pwd.handleSubmit(async () => {
          // TODO : vérifier l'ancien mot de passe et enregistrer le nouveau via l'API
          await new Promise((r) => setTimeout(r, 600))
          pwd.reset()
          markPwd()
        })}
        saved={pwdSaved}
      >
        <div className="grid gap-5 sm:grid-cols-3">
          {(['current', 'next', 'confirm'] as const).map((k) => (
            <Field key={k} id={`pwd-${k}`} label={t(`dashboard.profile.pwd.${k}`)} error={pwdErr(k)}>
              <input id={`pwd-${k}`} type={show ? 'text' : 'password'} maxLength={12} autoComplete={k === 'current' ? 'current-password' : 'new-password'} {...pwd.register(k)} className={inputClass(!!pwdErr(k))} />
            </Field>
          ))}
        </div>
        <button type="button" onClick={() => setShow((s) => !s)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-green">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? t('login.hidePassword') : t('login.showPassword')}
        </button>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <Lock className="size-3.5" /> {t('dashboard.profile.pwdNote')}
        </p>
      </Section>
    </div>
  )
}
