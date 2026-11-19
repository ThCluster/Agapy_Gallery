import { TrainFront } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { useArtistCount } from '@/lib/artistCounter'
import { formatNumber } from '@/lib/format'
import { displayPrice, PRICES, useRegion } from '@/lib/pricing'
import type { PhotoKey } from '@/mocks/photos'
import { SearchPanel } from './SearchPanel'

const SLIDES: { photo: PhotoKey; key: string }[] = [
  { photo: 'hero_villa', key: 'villa' },
  { photo: 'hero_gallery', key: 'gallery' },
  { photo: 'hero_hall', key: 'hall' },
]
const SLIDE_MS = 7000

export function HeroSection() {
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  const [index, setIndex] = useState(0)
  // Nombre d'artistes inscrits (/site/stats/), 1 500 au minimum
  const count = useArtistCount()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-brand-green-hover sm:min-h-[min(92vh,860px)] sm:items-center">
      {/* Diaporama en fondu, avec un lent zoom sur la photo active */}
      {SLIDES.map((s, i) => (
        <div
          key={s.photo}
          aria-hidden={i !== index}
          className={`absolute inset-0 -z-10 transition-opacity duration-[1500ms] ease-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
        >
          <Img
            photo={s.photo}
            alt=""
            priority={i === 0}
            className={`h-full w-full object-cover ${i === index ? 'animate-[agapy-kenburns_9s_ease-out_forwards] motion-reduce:animate-none' : ''}`}
          />
        </div>
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/60 via-black/25 to-black/10 sm:bg-gradient-to-r sm:from-black/55 sm:via-black/20 sm:to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-4 [text-shadow:0_2px_18px_rgb(0_0_0/0.35)] pt-32 pb-14 sm:px-6 sm:pt-36 sm:pb-24">
        <p className="eyebrow text-brand-yellow">{t('home.hero.eyebrow')}</p>
        <h1 className="mt-4 max-w-3xl text-[2.6rem] leading-[1.02] font-light tracking-tight text-white sm:text-7xl dark:text-white">
          {t('home.hero.titleStart')} <span className="font-extrabold">{t('home.hero.titleEnd')}</span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">{t('home.hero.subtitle')}</p>

        <div className="mt-8">
          <SearchPanel />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 text-white">
          <Link to="/ville" className="btn-action px-6 py-3 text-[15px] shadow-lg shadow-brand-orange/25">
            <TrainFront className="size-5" /> {t('home.hero.cta')}
          </Link>
          <p className="text-sm text-white/75">
            <span className="block text-2xl font-extrabold text-white">{formatNumber(count, i18n.resolvedLanguage)}</span>
            {t('home.hero.counter')}
          </p>
          <p className="text-sm text-white/75">
            <span className="block text-2xl font-extrabold text-white">{displayPrice(PRICES.visit, region, i18n.resolvedLanguage)}</span>
            {t('home.hero.visitPrice')}
          </p>
        </div>
      </div>

      {/* Légende et points du diaporama */}
      <div className="absolute right-4 bottom-5 hidden items-center gap-3 sm:flex sm:right-6">
        <p className="text-xs text-white/70">{t(`home.hero.slides.${SLIDES[index].key}`)}</p>
        <div className="flex gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t(`home.hero.slides.${s.key}`)}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
