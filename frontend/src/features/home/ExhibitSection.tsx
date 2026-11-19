import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import { formatPrice, PRICES, useRegion, withVat } from '@/lib/pricing'

/** Offre aux artistes : tarifs d'hébergement et de publication selon la zone. */
export function ExhibitSection() {
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  const lng = i18n.resolvedLanguage

  const rows = (['signup', 'publication', 'renewal'] as const).map((key) => {
    const p = PRICES[key][region]
    return {
      key,
      ht: formatPrice(p, lng),
      // TVA (20 %) facturée dans toutes les zones
      ttc: formatPrice({ ...p, amount: withVat(p.amount) }, lng),
    }
  })
  const perks = ['revenue', 'donations', 'copyright', 'moderation', 'wallet'] as const

  return (
    <section className="py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-mist lg:sticky lg:top-32">
            <Img photo="portrait_r1" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <p className="absolute inset-x-6 bottom-6 text-2xl leading-snug font-light text-white sm:text-3xl">{t('home.exhibit.quote')}</p>
          </div>
        </Reveal>

        <Reveal>
          <p className="eyebrow">{t('home.exhibit.eyebrow')}</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('home.exhibit.title')}</h2>
          <p className="mt-4 leading-relaxed text-gray-500">{t('home.exhibit.text')}</p>

          <dl className="mt-8 divide-y divide-brand-graphite/10 border-y border-brand-graphite/10 dark:divide-white/10 dark:border-white/10">
            {rows.map((r) => (
              <div key={r.key} className="flex items-baseline justify-between gap-4 py-4">
                <dt>
                  <span className="block font-medium text-brand-graphite dark:text-white">{t(`home.exhibit.prices.${r.key}`)}</span>
                  <span className="block text-xs text-gray-500">{t(`home.exhibit.prices.${r.key}Note`)}</span>
                </dt>
                <dd className="shrink-0 text-right">
                  <span className="block font-semibold text-brand-green dark:text-emerald-400">
                    {r.ht} <span className="text-xs font-normal text-gray-500">{t('home.exhibit.ht')}</span>
                  </span>
                  {r.ttc && (
                    <span className="block text-xs text-gray-500">
                      {r.ttc} {t('home.exhibit.ttc')}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex gap-3 text-sm text-brand-ink dark:text-slate-300">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-green dark:text-emerald-400" /> {t(`home.exhibit.perks.${p}`)}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/inscription" className="btn-action px-7 py-3 text-[15px]">
              {t('nav.register')}
            </Link>
            <Link to="/conditions-generales" className="link text-sm">
              {t('home.exhibit.terms')}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
