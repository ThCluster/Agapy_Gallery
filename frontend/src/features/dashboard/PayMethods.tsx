import { CheckCircle2, Clock, CreditCard, Smartphone, Wallet, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePaymentReturn, useWallet } from '@/api/artistSpace'
import { toNumber } from '@/lib/api'
import { formatMoney } from './revenue'

export type PayMethod = 'wallet' | 'momo' | 'card'

/**
 * Choix du moyen de paiement dans l'espace artiste. Le Compte d'Avoir n'est proposé
 * que s'il est activé et suffisamment approvisionné (cahier des charges, p. 12-13).
 */
export function PayMethods({ value, onChange, amount, allowWallet = true }: { value: PayMethod; onChange: (m: PayMethod) => void; amount: number; allowWallet?: boolean }) {
  const { t, i18n } = useTranslation()
  const { data } = useWallet()
  const wallet = { active: !!data?.is_active, balance: toNumber(data?.balance) }
  const formatXOF = (v: number, l?: string) => formatMoney(v, data?.currency, l)
  const walletOk = allowWallet && wallet.active && wallet.balance >= amount

  const options: { id: PayMethod; icon: typeof Wallet; title: string; hint: string; disabled?: boolean }[] = [
    ...(allowWallet
      ? [
          {
            id: 'wallet' as const,
            icon: Wallet,
            title: t('dashboard.pay.wallet'),
            hint: !wallet.active
              ? t('dashboard.pay.walletInactive')
              : walletOk
                ? t('dashboard.pay.walletBalance', { balance: formatXOF(wallet.balance, i18n.resolvedLanguage) })
                : t('dashboard.pay.walletLow', { balance: formatXOF(wallet.balance, i18n.resolvedLanguage) }),
            disabled: !walletOk,
          },
        ]
      : []),
    { id: 'momo', icon: Smartphone, title: t('signup.payment.momo'), hint: t('signup.payment.momoHint') },
    { id: 'card', icon: CreditCard, title: t('signup.payment.card'), hint: t('signup.payment.cardHint') },
  ]

  return (
    <div role="radiogroup" aria-label={t('signup.payment.method')} className="grid gap-3 sm:grid-cols-3">
      {options.map(({ id, icon: Icon, title, hint, disabled }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
            value === id ? 'border-brand-green ring-2 ring-brand-green' : 'border-brand-graphite/10 enabled:hover:border-brand-green/40 dark:border-white/10'
          }`}
        >
          <Icon className={`mt-0.5 size-5 shrink-0 ${id === 'wallet' ? 'text-brand-orange' : 'text-brand-green'}`} />
          <span>
            <span className="block text-sm font-semibold text-brand-graphite dark:text-white">{title}</span>
            <span className="block text-xs text-gray-500">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * Résultat d'un paiement au retour de la page du prestataire (?payment=<réf>) : état réel lu
 * auprès de l'API par usePaymentReturn, qui recharge aussi les données de l'espace artiste.
 */
export function PaymentReturnNotice() {
  const { t } = useTranslation()
  const ret = usePaymentReturn()
  if (!ret) return null
  const ok = ret.status === 'succeeded'
  const pending = ret.status === 'pending' || ret.status === 'checking'
  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : pending ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : pending ? <Clock className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
      <p>{t(`dashboard.paymentReturn.${ok ? 'succeeded' : pending ? 'pending' : 'failed'}`)}</p>
    </div>
  )
}
