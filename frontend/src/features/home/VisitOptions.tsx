import { Eye, Gift, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { displayPrice, DONATION_ARTIST_SHARE, PRICES, useRegion } from '@/lib/pricing'

/** Les choix du visiteur devant une galerie : visiter, faire un don, ou les deux. */
export function VisitOptions() {
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  const visit = displayPrice(PRICES.visit, region, i18n.resolvedLanguage)
  const share = `${Math.round(DONATION_ARTIST_SHARE * 100)} %`

  const options = [
    { key: 'visit', icon: Eye, value: visit, note: t(`home.options.visitNote.${region}`) },
    { key: 'donate', icon: Gift, value: share, note: t('home.options.donateNote') },
    { key: 'both', icon: Sparkles, value: `${visit} + ${t('home.options.gift')}`, note: t('home.options.bothNote') },
  ] as const

  return (
    <section className="bg-brand-mist py-24 dark:bg-night-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow={t('home.options.eyebrow')} title={t('home.options.title')} subtitle={t('home.options.subtitle')} />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {options.map(({ key, icon: Icon, value, note }) => (
            <Reveal key={key}>
              <div className="flex h-full flex-col rounded-2xl border border-brand-green/10 bg-white p-8 shadow-[0_12px_40px_-24px_rgb(0_103_79/0.35)] transition hover:-translate-y-1 hover:shadow-[0_20px_50px_-24px_rgb(0_103_79/0.45)] dark:border-white/10 dark:bg-night-field">
                <span className="grid size-12 place-items-center rounded-full bg-brand-orange/10 text-brand-orange">
                  <Icon className="size-6" />
                </span>
                <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-gray-500 uppercase">{t(`home.options.${key}`)}</p>
                <p className="mt-2 text-3xl font-light text-brand-green dark:text-emerald-400">{value}</p>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{note}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-8 text-sm text-gray-500">
            {t('home.options.free')}{' '}
            <Link to="/galeries-gratuites" className="link font-semibold">
              {t('home.options.freeCta')} →
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
