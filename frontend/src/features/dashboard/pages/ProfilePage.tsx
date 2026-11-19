import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { changePassword, getMe, updateMe, updatePayout, type PayoutInput } from '@/api/accounts'
import { useMyGallery, useUpdateGallery } from '@/api/artistSpace'
import { Img } from '@/components/ui/Img'
import { PASSWORD_RULE } from '@/features/auth/loginSchema'
import { Field } from '@/features/signup/Field'
import { inputClass } from '@/features/signup/inputClass'
import { isValidIban, MOMO_OPERATORS } from '@/features/signup/schema'
import { ApiError, errorMessage } from '@/lib/api'
import { useAuth, type SessionUser } from '@/stores/auth'

/** Bloc de réglages avec son bouton d'enregistrement et un message de confirmation */
function Section({
  id,
  title,
  text,
  children,
  onSave,
  saved,
  busy,
  error,
}: {
  id?: string
  title: string
  text?: string
  children: ReactNode
  onSave: () => void
  saved: boolean
  busy?: boolean
  error?: string | null
}) {
  const { t } = useTranslation()
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
      <h2 className="text-lg font-semibold text-brand-graphite dark:text-white">{title}</h2>
      {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
      <div className="mt-5">{children}</div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onSave} disabled={busy} className="btn-primary rounded-full px-5">
          {busy && <Loader2 className="size-4 animate-spin" />} {t('dashboard.profile.save')}
        </button>
        {saved && (
          <span role="status" className="flex items-center gap-1 text-sm text-emerald-700">
            <Check className="size-4" /> {t('dashboard.profile.saved')}
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm text-rose-600">
            {error}
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

/** Erreurs par champ renvoyées par l'API : { champ: 'errors.<code>' } */
function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(error.fieldCodes()).map(([k, c]) => [k, `errors.${c}`]))
}

/** Message général d'une erreur sans champ du formulaire */
function generalError(error: unknown, fields: string[]): string | null {
  if (!error) return null
  const codes = error instanceof ApiError ? Object.keys(error.fieldCodes()) : []
  return codes.some((k) => fields.includes(k)) ? null : errorMessage(error)
}

/** Date du jour (AAAA-MM-JJ) : la gratuité ne peut pas se terminer dans le passé */
const TODAY = new Date().toISOString().slice(0, 10)

const str = (v: unknown) => (typeof v === 'string' ? v : '')

const passwordSchema = z
  .object({
    current: z.string().min(1, 'login.errors.passwordRequired'),
    next: z.string().regex(PASSWORD_RULE, 'login.errors.passwordFormat'),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    path: ['confirm'],
    message: 'dashboard.profile.errors.mismatch',
  })
type PasswordForm = z.infer<typeof passwordSchema>

/** Profil : toutes les informations restent modifiables par l'artiste (cahier des charges, p. 17). */
export function ProfilePage() {
  const sessionUser = useAuth((s) => s.user)
  const setUser = useAuth((s) => s.setUser)
  const me = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    initialData: sessionUser ?? undefined,
  })

  if (me.isPending)
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="size-8 animate-spin text-brand-green" />
      </div>
    )
  if (me.isError || !me.data.artist)
    return (
      <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {errorMessage(me.error)}
      </p>
    )

  return <ProfileForms user={me.data} onUser={setUser} />
}

function ProfileForms({ user, onUser }: { user: SessionUser; onUser: (u: SessionUser) => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const setAccess = useAuth((s) => s.setAccess)
  const artist = user.artist!
  const isOrg = artist.civility === 'org'
  const nameField = isOrg ? 'org_name' : 'artist_name'

  const applyUser = (u: SessionUser) => {
    queryClient.setQueryData(['me'], u)
    onUser(u)
  }

  // Informations publiques
  const initialInfo = () => ({
    name: str(artist[nameField]),
    bio: str(artist.bio),
    city: str(artist.city),
    email: user.email ?? '',
    website: str(artist.website),
    instagram: str(artist.instagram),
  })
  const [info, setInfo] = useState(initialInfo)
  const [photo, setPhoto] = useState<File | null>(null)
  const [infoSaved, markInfo] = useSaved()
  const infoMutation = useMutation({
    mutationFn: () =>
      updateMe({
        [nameField]: info.name,
        bio: info.bio,
        city: info.city,
        email: info.email,
        website: info.website,
        instagram: info.instagram,
        ...(photo ? { photo } : {}),
      }),
    onSuccess: (u) => {
      applyUser(u)
      setPhoto(null)
      markInfo()
    },
  })
  const infoErr = fieldErrors(infoMutation.error)

  // Statut de la galerie
  const gallery = useMyGallery()
  const updateGallery = useUpdateGallery()
  // Valeurs modifiées localement ; sinon celles de l'API
  const [freeEdit, setFree] = useState<boolean | null>(null)
  const [untilEdit, setUntil] = useState<string | null>(null)
  const free = freeEdit ?? gallery.data?.is_free ?? false
  const until = untilEdit ?? gallery.data?.free_until ?? ''
  const [gallerySaved, markGallery] = useSaved()

  // Versements
  const [payout, setPayout] = useState({
    operator: str(artist.momo_operator) || MOMO_OPERATORS[0],
    momo: str(artist.momo_number_display) || str(artist.momo_number),
    iban: str(artist.iban),
    holder: str(artist.account_holder),
  })
  const [ibanError, setIbanError] = useState(false)
  const [payoutSaved, markPayout] = useSaved()
  const payoutMutation = useMutation({
    mutationFn: () => {
      const body: Partial<PayoutInput> = {
        payout_momo: !!payout.momo,
        momo_operator: payout.momo ? payout.operator : '',
        payout_iban: !!payout.iban,
        iban: payout.iban,
        account_holder: payout.holder,
      }
      // Le numéro n'est renvoyé que s'il a changé (il est normalisé par le backend)
      if (payout.momo !== (str(artist.momo_number_display) || str(artist.momo_number))) body.momo_number = payout.momo
      return updatePayout(body)
    },
    onSuccess: (u) => {
      applyUser(u)
      markPayout()
    },
  })
  const payoutErr = fieldErrors(payoutMutation.error)

  // Mot de passe
  const [show, setShow] = useState(false)
  const pwd = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: '', next: '', confirm: '' },
  })
  const [pwdSaved, markPwd] = useSaved()
  const [pwdError, setPwdError] = useState<string | null>(null)
  const pwdErr = (k: keyof PasswordForm) => pwd.formState.errors[k]?.message

  const photoUrl = photo ? URL.createObjectURL(photo) : str(artist.photo) || undefined

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t('dashboard.nav.profile')}</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight">{t('dashboard.profile.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.profile.subtitle')}</p>
      </div>

      <Section
        title={t('dashboard.profile.public')}
        onSave={() => infoMutation.mutate()}
        saved={infoSaved}
        busy={infoMutation.isPending}
        error={generalError(infoMutation.error, [nameField, 'bio', 'city', 'email', 'website', 'instagram', 'photo'])}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="p-photo" label={t(isOrg ? 'signup.fields.logo' : 'signup.fields.photo')} error={infoErr.photo} hint={t('signup.fields.photoFormats')} className="sm:col-span-2">
            <div className="flex items-center gap-4">
              <span className="block size-16 shrink-0 overflow-hidden rounded-full bg-brand-mist">
                <Img src={photoUrl} alt="" className="h-full w-full object-cover" />
              </span>
              <input id="p-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="text-sm text-gray-500" />
            </div>
          </Field>
          <Field id="p-name" label={t(isOrg ? 'signup.fields.orgName' : 'signup.fields.artistName')} error={infoErr[nameField]}>
            <input id="p-name" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className={inputClass(!!infoErr[nameField])} />
          </Field>
          <Field id="p-city" label={t('signup.fields.city')} error={infoErr.city}>
            <input id="p-city" value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} className={inputClass(!!infoErr.city)} />
          </Field>
          <Field id="p-bio" label={t('dashboard.profile.bio')} error={infoErr.bio} className="sm:col-span-2">
            <textarea id="p-bio" rows={4} value={info.bio} onChange={(e) => setInfo({ ...info, bio: e.target.value })} className={inputClass(!!infoErr.bio)} />
          </Field>
          <Field id="p-phone" label={t('dashboard.profile.login')} hint={t('dashboard.profile.loginHint')}>
            <input id="p-phone" value={str(user.phone_display) || user.phone} readOnly className={`${inputClass()} bg-brand-mist text-gray-500`} />
          </Field>
          <Field id="p-email" label={t('signup.fields.email')} error={infoErr.email}>
            <input id="p-email" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} className={inputClass(!!infoErr.email)} />
          </Field>
          <Field id="p-web" label={t('signup.fields.website')} optional error={infoErr.website}>
            <input id="p-web" type="url" value={info.website} onChange={(e) => setInfo({ ...info, website: e.target.value })} placeholder="https://" className={inputClass(!!infoErr.website)} />
          </Field>
          <Field id="p-ig" label={t('signup.fields.instagram')} optional error={infoErr.instagram}>
            <input id="p-ig" type="url" value={info.instagram} onChange={(e) => setInfo({ ...info, instagram: e.target.value })} placeholder="https://" className={inputClass(!!infoErr.instagram)} />
          </Field>
        </div>
      </Section>

      {/* Galerie gratuite ou payante, gratuité éventuellement limitée dans le temps (p. 9-10) */}
      <Section
        id="galerie"
        title={t('dashboard.profile.gallery')}
        text={t('dashboard.profile.galleryText')}
        onSave={() => updateGallery.mutate({ is_free: free, free_until: free && until ? until : null }, { onSuccess: markGallery })}
        saved={gallerySaved}
        busy={updateGallery.isPending}
        error={updateGallery.error ? errorMessage(updateGallery.error, 'free_until') : gallery.error ? errorMessage(gallery.error) : null}
      >
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
          if (!bad) payoutMutation.mutate()
        }}
        saved={payoutSaved}
        busy={payoutMutation.isPending}
        error={generalError(payoutMutation.error, ['momo_operator', 'momo_number', 'iban', 'account_holder'])}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="p-op" label={t('signup.fields.operator')} error={payoutErr.momo_operator}>
            <select id="p-op" value={payout.operator} onChange={(e) => setPayout({ ...payout, operator: e.target.value })} className={inputClass(!!payoutErr.momo_operator)}>
              {MOMO_OPERATORS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field id="p-momo" label={t('signup.fields.momoNumber')} error={payoutErr.momo_number}>
            <input id="p-momo" type="tel" value={payout.momo} onChange={(e) => setPayout({ ...payout, momo: e.target.value })} className={inputClass(!!payoutErr.momo_number)} />
          </Field>
          <Field id="p-iban" label="IBAN" optional error={ibanError ? 'signup.errors.iban' : payoutErr.iban}>
            <input id="p-iban" value={payout.iban} onChange={(e) => setPayout({ ...payout, iban: e.target.value })} className={`${inputClass(ibanError || !!payoutErr.iban)} font-mono uppercase`} />
          </Field>
          <Field id="p-holder" label={t('signup.fields.accountHolder')} optional error={payoutErr.account_holder}>
            <input id="p-holder" value={payout.holder} onChange={(e) => setPayout({ ...payout, holder: e.target.value })} className={inputClass(!!payoutErr.account_holder)} />
          </Field>
        </div>
      </Section>

      {/* Mot de passe : modifiable à souhait (p. 15) */}
      <Section
        title={t('dashboard.profile.password')}
        text={t('login.passwordHelp')}
        onSave={pwd.handleSubmit(async (d) => {
          setPwdError(null)
          try {
            const { access } = await changePassword({
              current_password: d.current,
              new_password: d.next,
            })
            // Les autres sessions sont fermées ; celle-ci reçoit un nouveau jeton
            setAccess(access)
            pwd.reset()
            markPwd()
          } catch (e) {
            const codes = e instanceof ApiError ? e.fieldCodes() : {}
            if (codes.current_password)
              pwd.setError('current', {
                message: `errors.${codes.current_password}`,
              })
            if (codes.new_password) pwd.setError('next', { message: `errors.${codes.new_password}` })
            if (!codes.current_password && !codes.new_password) setPwdError(errorMessage(e))
          }
        })}
        saved={pwdSaved}
        busy={pwd.formState.isSubmitting}
        error={pwdError}
      >
        <div className="grid gap-5 sm:grid-cols-3">
          {(['current', 'next', 'confirm'] as const).map((k) => (
            <Field key={k} id={`pwd-${k}`} label={t(`dashboard.profile.pwd.${k}`)} error={pwdErr(k)}>
              <input
                id={`pwd-${k}`}
                type={show ? 'text' : 'password'}
                maxLength={12}
                autoComplete={k === 'current' ? 'current-password' : 'new-password'}
                {...pwd.register(k)}
                className={inputClass(!!pwdErr(k))}
              />
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
