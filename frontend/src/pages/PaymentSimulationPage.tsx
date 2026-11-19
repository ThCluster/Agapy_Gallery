import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, FlaskConical, Loader2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { getPayment, readPaymentReturn, simulatePayment } from '@/api/payments'
import { errorMessage, toNumber } from '@/lib/api'
import { formatPrice } from '@/lib/pricing'

/** Ajoute ?payment=<réf>&status=<statut> à l'adresse de retour */
function withResult(returnTo: string, reference: string, status: string): string {
  const url = new URL(returnTo, window.location.origin)
  url.searchParams.set('payment', reference)
  url.searchParams.set('status', status)
  return url.pathname + url.search + url.hash
}

/**
 * Paiement simulé : moyen de paiement officiel tant que le paiement en ligne réel n'est pas activé,
 * pour TOUS les paiements du site (ouverture, publication, visite, don, clip…). /paiement/simulation?ref=<référence>
 * Le retour passe par readPaymentReturn(), qui n'accepte qu'un chemin interne.
 */
export function PaymentSimulationPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const [params] = useSearchParams()
  const reference = params.get('ref') ?? ''

  const payment = useQuery({
    queryKey: ['payment', reference],
    queryFn: () => getPayment(reference),
    enabled: !!reference,
    retry: false,
  })
  const simulate = useMutation({
    mutationFn: (status: 'succeeded' | 'failed') => simulatePayment(reference, status),
    onSuccess: (p) => window.location.assign(withResult(readPaymentReturn(reference), reference, p.status)),
  })

  const p = payment.data
  const price = (v: string) => (p ? formatPrice({ amount: toNumber(v), currency: p.currency }, lng) : '')
  const backToSite = () => window.location.assign(withResult(readPaymentReturn(reference), reference, p?.status ?? 'pending'))

  return (
    <section className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <p role="note" className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        <FlaskConical className="size-4 shrink-0" /> {t('auth.simulation.banner')}
      </p>

      <div className="mt-6 rounded-[2rem] border border-brand-green/10 bg-white p-6 shadow-[0_40px_100px_-60px_rgb(30_46_41/0.45)] sm:p-8 dark:border-white/10 dark:bg-night-card">
        <h1 className="text-2xl font-light tracking-tight sm:text-3xl">{t('auth.simulation.title')}</h1>

        {!reference ? (
          <p className="mt-4 text-sm text-gray-500">{t('auth.simulation.noReference')}</p>
        ) : payment.isPending ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-8 animate-spin text-brand-green" />
          </div>
        ) : payment.isError || !p ? (
          <p role="alert" className="mt-4 text-sm text-rose-600">
            {errorMessage(payment.error)}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-500">
              {t('auth.simulation.reference')} <span className="font-mono font-medium text-brand-graphite dark:text-white">{p.reference}</span>
              {p.purpose && <> · {t(`auth.simulation.purpose.${p.purpose}`)}</>}
            </p>

            <dl className="mt-6 space-y-3 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-brand-ink dark:text-slate-300">{t('auth.simulation.ht')}</dt>
                <dd className="font-medium text-brand-graphite dark:text-white">{price(p.amount_ht)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-ink dark:text-slate-300">{t('auth.simulation.vat')}</dt>
                <dd className="font-medium text-brand-graphite dark:text-white">{price(p.vat)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-brand-graphite/10 pt-4 dark:border-white/10">
                <dt className="font-semibold text-brand-graphite dark:text-white">{t('auth.simulation.ttc')}</dt>
                <dd className="text-3xl font-semibold text-brand-graphite dark:text-white">{price(p.amount_ttc)}</dd>
              </div>
            </dl>

            {simulate.error && (
              <p role="alert" className="mt-4 text-sm text-rose-600">
                {errorMessage(simulate.error)}
              </p>
            )}

            {p.status === 'pending' ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={simulate.isPending} onClick={() => simulate.mutate('succeeded')} className="btn-action rounded-full py-3.5">
                  {simulate.isPending && simulate.variables === 'succeeded' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {t('auth.simulation.pay')}
                </button>
                <button type="button" disabled={simulate.isPending} onClick={() => simulate.mutate('failed')} className="btn-secondary rounded-full py-3.5">
                  {simulate.isPending && simulate.variables === 'failed' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} {t('auth.simulation.refuse')}
                </button>
              </div>
            ) : (
              <div className="mt-8">
                <p className="text-sm text-gray-500">{t(`auth.simulation.already.${p.status}`)}</p>
                <button type="button" onClick={backToSite} className="btn-primary mt-4 rounded-full px-6 py-3">
                  {t('auth.simulation.back')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        <Link to="/" className="link">
          {t('auth.simulation.home')}
        </Link>
      </p>
    </section>
  )
}
