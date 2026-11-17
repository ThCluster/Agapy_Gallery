import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AdSlot } from '@/components/ui/AdSlot'
import { Reveal } from '@/components/ui/Reveal'

/** Espaces annonceurs de l'accueil : billboard 336 × 280, bannière 468 × 60 et boutons 88 × 31. */
export function AdvertisersSection() {
  const { t } = useTranslation()
  return (
    <section aria-label={t('ads.section')} className="border-y border-brand-graphite/10 bg-brand-mist py-14 dark:border-white/10 dark:bg-night-card">
      <Reveal>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[336px_1fr]">
          <AdSlot format="336x280" className="mx-auto" />
          <div className="space-y-6">
            <div>
              <p className="eyebrow">{t('ads.eyebrow')}</p>
              <p className="mt-2 text-2xl font-light text-brand-graphite dark:text-white">{t('ads.title')}</p>
              <p className="mt-2 text-sm text-gray-500">{t('ads.text')}</p>
            </div>
            <AdSlot format="468x60" />
            <div className="flex flex-wrap items-center gap-3">
              <AdSlot format="88x31" />
              <AdSlot format="88x31" />
              <AdSlot format="88x31" />
              <Link to="/publicite" className="link ml-2 text-sm font-semibold">
                {t('ads.more')} →
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
