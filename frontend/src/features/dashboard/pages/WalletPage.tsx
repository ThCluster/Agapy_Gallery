import { CheckCircle2, Lock, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatXOF } from '@/lib/format'
import { useArtistSpace } from '@/stores/artistSpace'
import { PayMethods, type PayMethod } from '../PayMethods'

const AMOUNTS = [5_000, 10_000, 20_000, 50_000]

/**
 * Compte d'Avoir (cahier des charges, p. 12-13) : provision d'argent pour payer publications
 * et renouvellements sans ressortir sa carte ou son téléphone. Créé à l'inscription,
 * désactivé par défaut, activable et désactivable à tout moment.
 */
export function WalletPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage
  const { wallet, setWalletActive, topUp } = useArtistSpace()
  const [amount, setAmount] = useState(AMOUNTS[1])
  const [custom, setCustom] = useState('')
  const [method, setMethod] = useState<PayMethod>('momo')
  const [status, setStatus] = useState<'idle' | 'paying' | 'done'>('idle')
  const value = Number(custom) || amount
  const dateFmt = new Intl.DateTimeFormat(lng, { day: 'numeric', month: 'short', year: 'numeric' })

  const recharge = async () => {
    setStatus('paying')
    // TODO : paiement de la recharge via le prestataire (mobile money ou carte)
    await new Promise((r) => setTimeout(r, 1400))
    topUp(value, method === 'momo' ? t('dashboard.wallet.topUpMomo') : t('dashboard.wallet.topUpCard'))
    setStatus('done')
    setCustom('')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t('dashboard.nav.wallet')}</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight">{t('dashboard.wallet.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('dashboard.wallet.subtitle')}</p>
      </div>

      {/* Solde et activation */}
      <div className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-white to-brand-mist p-6 sm:flex-row sm:items-center sm:justify-between dark:from-night-card dark:to-night-field">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-orange/10 text-brand-orange">
            <Wallet className="size-7" />
          </span>
          <div>
            <p className="text-sm text-gray-500">{t('dashboard.wallet.balance')}</p>
            <p className="text-3xl font-semibold tracking-tight text-brand-graphite tabular-nums dark:text-white">{formatXOF(wallet.balance, lng)}</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-night-card">
          <span className="text-sm">
            <span className="block font-semibold text-brand-graphite dark:text-white">{wallet.active ? t('dashboard.wallet.active') : t('dashboard.wallet.inactive')}</span>
            <span className="block text-xs text-gray-500">{wallet.active ? t('dashboard.wallet.activeHint') : t('dashboard.wallet.inactiveHint')}</span>
          </span>
          <span className="relative inline-flex">
            <input type="checkbox" checked={wallet.active} onChange={(e) => setWalletActive(e.target.checked)} className="peer sr-only" />
            <span className="h-7 w-12 rounded-full bg-brand-graphite/20 transition peer-checked:bg-brand-green peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange" />
            <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </span>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recharger */}
        <section className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
          <h2 className="text-lg font-semibold text-brand-graphite dark:text-white">{t('dashboard.wallet.topUp')}</h2>
          {status === 'done' ? (
            <div className="mt-6 text-center">
              <CheckCircle2 className="mx-auto size-10 text-brand-green" />
              <p className="mt-3 font-semibold">{t('dashboard.wallet.topUpDone')}</p>
              <button type="button" onClick={() => setStatus('idle')} className="link mt-3 text-sm">
                {t('dashboard.wallet.topUpAgain')}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAmount(a)
                      setCustom('')
                    }}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${!custom && amount === a ? 'border-brand-orange bg-brand-orange text-white' : 'border-brand-graphite/15 hover:border-brand-orange'}`}
                  >
                    {formatXOF(a, lng)}
                  </button>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="sr-only">{t('artist.support.customAmount')}</span>
                <input type="number" min={500} step={500} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t('artist.support.customAmount')} className="field" />
              </label>
              <div className="mt-5">
                <PayMethods value={method === 'wallet' ? 'momo' : method} onChange={setMethod} amount={value} allowWallet={false} />
              </div>
              <button type="button" onClick={recharge} disabled={status === 'paying' || value < 500} className="btn-action mt-5 w-full rounded-full py-3">
                <Lock className="size-4" /> {status === 'paying' ? t('signup.paying') : t('dashboard.wallet.topUpPay', { amount: formatXOF(value, lng) })}
              </button>
            </>
          )}
        </section>

        {/* Historique */}
        <section className="rounded-3xl border border-brand-green/10 bg-white p-6 dark:border-white/10 dark:bg-night-card">
          <h2 className="text-lg font-semibold text-brand-graphite dark:text-white">{t('dashboard.wallet.history')}</h2>
          {wallet.history.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">{t('dashboard.wallet.noHistory')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-brand-graphite/5 dark:divide-white/5">
              {wallet.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>
                    <span className="block text-brand-graphite dark:text-white">{h.label}</span>
                    <span className="block text-xs text-gray-500">{dateFmt.format(new Date(h.date))}</span>
                  </span>
                  <span className={`font-semibold tabular-nums ${h.amount >= 0 ? 'text-emerald-700' : 'text-brand-graphite dark:text-white'}`}>
                    {h.amount >= 0 ? '+' : '−'}
                    {formatXOF(Math.abs(h.amount), lng)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
