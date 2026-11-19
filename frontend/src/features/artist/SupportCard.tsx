import { Check, CreditCard, Gift, Lock, Smartphone, TrainFront } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { isPaymentStarted, PENDING_DONATION_KEY, sendDonation, startVisit, type CatalogArtist, type PendingDonation } from '@/api/catalog'
import { followPaymentAction, type PaymentMethod } from '@/api/payments'
import { errorMessage } from '@/lib/api'
import { DONATION_ARTIST_SHARE, formatPrice, PRICES, useRegion, withVat, type Currency, type Region } from '@/lib/pricing'

/** Montants de don proposés selon la zone */
const DONATIONS: Record<Region, { currency: Currency; amounts: number[] }> = {
  africa: { currency: 'XOF', amounts: [500, 1000, 2000, 5000] },
  europe: { currency: 'EUR', amounts: [2, 5, 10, 20] },
  world: { currency: 'USD', amounts: [2, 5, 10, 20] },
}

/**
 * Les choix du visiteur (cahier des charges, p. 11) : visiter la galerie,
 * faire un don, les deux… ou simplement s'arrêter là.
 */
interface Props {
  artist: CatalogArtist
  /** Droit de visite déjà acquis (galerie gratuite ou jeton valide) */
  hasAccess?: boolean
  /** Paiement confirmé sans redirection (ex. Compte d'Avoir) */
  onPaid?: (purpose: 'visit' | 'donation') => void
}

export function SupportCard({ artist, hasAccess = false, onPaid }: Props) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const region = useRegion((s) => s.region)
  const lng = i18n.resolvedLanguage
  const free = !!artist.free || hasAccess
  const [method, setMethod] = useState<Exclude<PaymentMethod, 'wallet'>>('momo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [visit, setVisit] = useState(true)
  const [donate, setDonate] = useState(false)
  const [amount, setAmount] = useState(DONATIONS[region].amounts[1])
  const [custom, setCustom] = useState('')

  const { currency, amounts } = DONATIONS[region]
  const visitPrice = PRICES.visit[region]
  // Prix TTC pour l'Afrique (seule zone où la TVA est précisée)
  const visitAmount = free ? 0 : region === 'africa' ? withVat(visitPrice.amount) : visitPrice.amount
  const donation = donate ? Number(custom) || amount : 0
  const total = (visit ? visitAmount : 0) + donation
  const money = (n: number) => formatPrice({ amount: n, currency }, lng)

  const submit = async () => {
    setError(null)
    if (free && visit && !donation) {
      navigate(`/ville/${artist.id}`)
      return
    }
    setBusy(true)
    try {
      const gift: PendingDonation | null = donation ? { artist: artist.id, amount: donation, method, region } : null
      if (visit && !free) {
        // Galerie payante : la visite d'abord, le don éventuel est lancé au retour du paiement
        if (gift) sessionStorage.setItem(PENDING_DONATION_KEY, JSON.stringify(gift))
        const res = await startVisit({ artist: artist.id, method, region })
        if (!isPaymentStarted(res)) {
          // La galerie est devenue gratuite entre-temps
          sessionStorage.removeItem(PENDING_DONATION_KEY)
          onPaid?.('visit')
          if (!gift) return navigate(`/ville/${artist.id}`)
        } else if (followPaymentAction(res, `/artistes/${artist.id}`)) {
          sessionStorage.removeItem(PENDING_DONATION_KEY)
          onPaid?.('visit')
        } else return
        if (!gift) return
      }
      if (gift && (await sendDonation(gift))) onPaid?.('donation')
    } catch (e) {
      sessionStorage.removeItem(PENDING_DONATION_KEY)
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const option = (active: boolean) =>
    `flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
      active ? 'border-brand-green bg-brand-green/[0.04] ring-1 ring-brand-green' : 'border-brand-graphite/10 hover:border-brand-green/40 dark:border-white/10'
    }`
  const tick = (active: boolean) =>
    `mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${active ? 'border-brand-green bg-brand-green text-white' : 'border-brand-graphite/25'}`

  return (
    <div className="rounded-3xl border border-brand-green/10 bg-white p-6 shadow-[0_30px_80px_-45px_rgb(30_46_41/0.5)] dark:border-white/10 dark:bg-night-card">
      <p className="eyebrow">{t('artist.support.eyebrow')}</p>
      <h2 className="mt-2 text-2xl font-light tracking-tight text-brand-graphite dark:text-white">{t('artist.support.title', { name: artist.name })}</h2>

      <div className="mt-6 space-y-3">
        {/* Visite */}
        <button type="button" onClick={() => setVisit((v) => !v)} className={option(visit)} aria-pressed={visit}>
          <span className={tick(visit)}>{visit && <Check className="size-3.5" />}</span>
          <span className="flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-brand-graphite dark:text-white">{t('artist.support.visit')}</span>
              <span className="price">{free ? t('artwork.free') : money(visitAmount)}</span>
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">{free ? t('artist.support.visitFreeNote') : t(`artist.support.visitNote.${region}`)}</span>
          </span>
        </button>

        {/* Don */}
        <div className={option(donate)}>
          <button type="button" onClick={() => setDonate((d) => !d)} className="flex flex-1 items-start gap-3 text-left" aria-pressed={donate}>
            <span className={tick(donate)}>{donate && <Check className="size-3.5" />}</span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-semibold text-brand-graphite dark:text-white">
                <Gift className="size-4 text-brand-orange" /> {t('artist.support.donate')}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">{t('artist.support.donateNote', { share: Math.round(DONATION_ARTIST_SHARE * 100) })}</span>
            </span>
          </button>
        </div>
        {donate && (
          <div className="grid grid-cols-4 gap-2 pl-1">
            {amounts.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAmount(a)
                  setCustom('')
                }}
                className={`rounded-xl border px-1 py-2 text-xs font-semibold transition sm:text-sm ${
                  !custom && amount === a ? 'border-brand-orange bg-brand-orange text-white' : 'border-brand-graphite/15 text-brand-graphite hover:border-brand-orange dark:text-white'
                }`}
              >
                {money(a)}
              </button>
            ))}
            <label className="col-span-4">
              <span className="sr-only">{t('artist.support.customAmount')}</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={t('artist.support.customAmount')}
                className="field"
              />
            </label>
          </div>
        )}
      </div>

      {/* Moyen de paiement */}
      {total > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-500">{t('catalog.payment.method')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['momo', 'card'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={`flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${
                  method === m ? 'border-brand-green bg-brand-green/[0.06] text-brand-green ring-1 ring-brand-green' : 'border-brand-graphite/15 text-brand-graphite hover:border-brand-green/40 dark:text-white'
                }`}
              >
                {m === 'card' ? <CreditCard className="size-4" /> : <Smartphone className="size-4" />} {t(`catalog.payment.${m}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-baseline justify-between border-t border-brand-graphite/10 pt-4 dark:border-white/10">
        <span className="text-sm text-gray-500">{t('artist.support.total')}</span>
        <span className="text-2xl font-semibold text-brand-graphite dark:text-white">{money(total)}</span>
      </div>

      <button type="button" onClick={submit} disabled={(!visit && !donation) || busy} aria-busy={busy} className="btn-primary mt-4 w-full rounded-full py-3.5 text-[15px]">
        {free && visit && !donation ? (
          <>
            <TrainFront className="size-5" /> {t('artist.support.goFree')}
          </>
        ) : (
          <>
            <Lock className="size-4" /> {t('artist.support.pay')}
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="mt-3 text-center text-xs text-gray-500">{t('artist.support.methods')}</p>
      <p className="mt-1 text-center text-xs text-gray-400">{t('artist.support.stop')}</p>
    </div>
  )
}
