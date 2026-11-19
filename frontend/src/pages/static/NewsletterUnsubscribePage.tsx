import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Loader2, MailX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { unsubscribeNewsletter } from '@/api/site'
import { errorMessage } from '@/lib/api'

/** Désinscription de la newsletter depuis le lien reçu par e-mail (/newsletter/desinscription?token=…). */
export function NewsletterUnsubscribePage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const mutation = useMutation({ mutationFn: unsubscribeNewsletter })
  const sent = useRef(false)

  // Un seul envoi, même si React monte la page deux fois en développement
  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    mutation.mutate(token)
  }, [token, mutation])

  const error = !token ? t('content.newsletter.missingToken') : mutation.isError ? errorMessage(mutation.error, 'token') : null

  return (
    <section className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 lg:py-28">
        <p className="eyebrow">{t('content.newsletter.eyebrow')}</p>
        <div className="mt-6 rounded-3xl bg-white p-8 shadow-[0_30px_70px_-50px_rgb(30_46_41/0.5)] sm:p-10 dark:bg-night-card">
          {error ? (
            <div role="alert">
              <MailX className="mx-auto size-12 text-rose-500" />
              <h1 className="mt-4 text-2xl font-light tracking-tight text-brand-graphite dark:text-white">{t('content.newsletter.errorTitle')}</h1>
              <p className="mt-2 text-gray-500 dark:text-slate-400">{error}</p>
            </div>
          ) : mutation.isSuccess ? (
            <div role="status">
              <CheckCircle2 className="mx-auto size-12 text-brand-green dark:text-emerald-400" />
              <h1 className="mt-4 text-2xl font-light tracking-tight text-brand-graphite dark:text-white">{t('content.newsletter.doneTitle')}</h1>
              <p className="mt-2 text-gray-500 dark:text-slate-400">{t('content.newsletter.doneText')}</p>
            </div>
          ) : (
            <div role="status" className="flex flex-col items-center gap-3 text-gray-500">
              <Loader2 className="size-8 animate-spin text-brand-orange" />
              <h1 className="text-lg">{t('content.newsletter.pending')}</h1>
            </div>
          )}
          <Link to="/" className="btn-secondary mt-8 rounded-full px-5 py-2.5">
            {t('content.backHome')}
          </Link>
        </div>
      </div>
    </section>
  )
}
