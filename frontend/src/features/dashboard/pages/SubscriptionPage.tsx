import { CalendarCheck, CheckCircle2, Lock, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRenew, useSubscription } from '@/api/artistSpace'
import { followPaymentAction } from '@/api/payments'
import { errorMessage, toNumber } from '@/lib/api'
import { PaymentReturnNotice, PayMethods, type PayMethod } from '../PayMethods'
import { formatMoney } from '../revenue'

const STATE_CLASS = { active: 'status-success', soon: 'status-pending', standby: 'status-error' } as const

/**
 * Renouvellement annuel (cahier des charges, p. 8) : à chaque date anniversaire, le compte
 * est mis en veille automatiquement et l'artiste ne peut plus publier jusqu'au paiement
 * de 10 000 F CFA HT (30 € en Europe, 35 $ ailleurs).
 */
export function SubscriptionPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage
  const { data, isPending, isError, error, refetch } = useSubscription()
  const renew = useRenew()
  const [method, setMethod] = useState<PayMethod>('momo')
  const [status, setStatus] = useState<'idle' | 'paying' | 'done'>('idle')
  const dateFmt = new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'long', year: 'numeric' })

  if (isPending) return <p className="text-sm text-gray-500">{t('dashboard.loading')}</p>
  if (isError) return <p className="text-sm text-rose-700">{errorMessage(error)}</p>

  const sub = { state: data.state, daysLeft: data.days_left }
  const openedAt = data.opened_at
  const expiresAt = data.expires_at
  const quote = data.renewal_quote
  const formatXOF = (v: number, l?: string) => formatMoney(v, quote.currency, l)
  const fee = toNumber(quote.amount_ht)
  const total = toNumber(quote.amount_ttc)

  const pay = () => {
    setStatus('paying')
    renew.mutate(method, {
      onSuccess: (started) => {
        if (followPaymentAction(started, '/tableau-de-bord/abonnement')) {
          void refetch()
          setStatus('done')
        }
      },
      onError: () => setStatus('idle'),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t('dashboard.nav.subscription')}</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight">{t('dashboard.subscription.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('dashboard.subscription.subtitle')}</p>
      </div>

      <PaymentReturnNotice />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-green/10 bg-white p-5 dark:border-white/10 dark:bg-night-card">
          <p className="text-xs font-medium text-gray-500">{t('dashboard.subscription.status')}</p>
          <p className="mt-2">
            <span className={STATE_CLASS[sub.state]}>{t(`dashboard.subscription.states.${sub.state}`)}</span>
          </p>
          {sub.state !== 'standby' && <p className="mt-2 text-xs text-gray-500">{t('dashboard.subscription.daysLeft', { count: sub.daysLeft })}</p>}
        </div>
        <div className="rounded-2xl border border-brand-green/10 bg-white p-5 dark:border-white/10 dark:bg-night-card">
          <p className="text-xs font-medium text-gray-500">{t('dashboard.subscription.openedAt')}</p>
          <p className="mt-2 font-semibold text-brand-graphite dark:text-white">{dateFmt.format(new Date(openedAt))}</p>
        </div>
        <div className="rounded-2xl border border-brand-green/10 bg-white p-5 dark:border-white/10 dark:bg-night-card">
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <CalendarCheck className="size-3.5" /> {t('dashboard.subscription.expiresAt')}
          </p>
          <p className="mt-2 font-semibold text-brand-graphite dark:text-white">{dateFmt.format(new Date(expiresAt))}</p>
        </div>
      </div>

      <section className="max-w-2xl rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
        {status === 'done' ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-10 text-brand-green" />
            <p className="mt-3 text-lg font-semibold">{t('dashboard.subscription.done')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('dashboard.subscription.doneText', { date: dateFmt.format(new Date(expiresAt)) })}</p>
          </div>
        ) : (
          <>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-graphite dark:text-white">
              <RefreshCw className="size-5 text-brand-green" /> {t('dashboard.subscription.renewTitle')}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{t('dashboard.subscription.renewText')}</p>
            <dl className="mt-5 space-y-2 text-[15px]">
              <div className="flex justify-between">
                <dt>{t('dashboard.subscription.fee')}</dt>
                <dd className="font-medium">
                  {formatXOF(fee, lng)} {t('home.exhibit.ht')}
                </dd>
              </div>
              <div className="flex justify-between text-gray-500">
                <dt>{t('signup.payment.vat')}</dt>
                <dd>{formatXOF(toNumber(quote.vat), lng)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-brand-graphite/10 pt-3 dark:border-white/10">
                <dt className="font-semibold">{t('signup.payment.total')}</dt>
                <dd className="text-2xl font-semibold">
                  {formatXOF(total, lng)} <span className="text-sm font-normal text-gray-500">{t('home.exhibit.ttc')}</span>
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-gray-500">{t('dashboard.subscription.otherZones')}</p>
            <div className="mt-6">
              <PayMethods value={method} onChange={setMethod} amount={total} />
            </div>
            {renew.isError && <p className="mt-4 text-sm text-rose-700">{errorMessage(renew.error, 'method')}</p>}
            <button type="button" onClick={pay} disabled={status === 'paying'} className="btn-action mt-6 rounded-full px-7 py-3.5">
              <Lock className="size-4" /> {status === 'paying' ? t('signup.paying') : t('payment.pay', { amount: formatXOF(total, lng) })}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
