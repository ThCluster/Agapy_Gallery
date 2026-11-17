import { ChevronLeft, ChevronRight, Pause, Play, Radio } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { formatXOF } from '@/lib/format'
import { CLIP_PRICE_XOF } from '@/lib/pricing'
import { clips } from '@/mocks/homeData'

/** Durée maximale d'un clip, et nombre de clips diffusés en boucle sur 24 h */
const CLIP_SECONDS = 30
const MAX_CLIPS = 50

/**
 * Espace des clips publicitaires : chaque clip passe 30 s puis le suivant
 * démarre automatiquement, en boucle. À côté : la file d'attente,
 * l'offre de diffusion et l'espace « AGAPY TV » pour les directs.
 */
export function ClipsSection() {
  const { t, i18n } = useTranslation()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const clip = clips[index]
  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + clips.length) % clips.length)
  const upNext = [1, 2, 3].map((n) => clips[(index + n) % clips.length])

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow={t('home.clips.eyebrow')} title={t('home.clips.title')} subtitle={t('home.clips.subtitle')} />
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Lecteur */}
          <Reveal>
            <div className="overflow-hidden rounded-2xl bg-brand-mist text-white shadow-[0_24px_60px_-30px_rgb(30_46_41/0.45)]">
              <div className="relative aspect-video">
                <Img key={clip.id} photo={clip.poster} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute top-4 left-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wider uppercase backdrop-blur">
                  {t('home.clips.ad')} · {index + 1} / {MAX_CLIPS}
                </span>
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? t('home.clips.play') : t('home.clips.pause')}
                  className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-graphite shadow-xl transition hover:scale-105"
                >
                  {paused ? <Play className="ml-1 size-7" /> : <Pause className="size-7" />}
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                  <div>
                    <p className="text-lg font-semibold sm:text-xl">{clip.title}</p>
                    <p className="text-sm text-white/70">{clip.advertiser}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => go(-1)} aria-label={t('common.previous')} className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/30">
                      <ChevronLeft className="size-5" />
                    </button>
                    <button type="button" onClick={() => go(1)} aria-label={t('common.next')} className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/30">
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                </div>
              </div>
              {/* Barre de progression : à la fin des 30 s, le clip suivant démarre tout seul */}
              <div className="h-1 bg-brand-green/10">
                <div
                  key={clip.id}
                  onAnimationEnd={() => go(1)}
                  className="h-full origin-left bg-brand-orange"
                  style={{ animation: `agapy-progress ${CLIP_SECONDS}s linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
                />
              </div>
            </div>
          </Reveal>

          <Reveal className="flex flex-col gap-4">
            {/* À suivre */}
            <div className="rounded-2xl border border-brand-green/10 bg-brand-mist p-4 dark:border-white/10 dark:bg-night-card">
              <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-gray-500 uppercase">{t('home.clips.next')}</p>
              <ul className="space-y-3">
                {upNext.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setIndex(clips.indexOf(c))} className="flex w-full items-center gap-3 rounded-lg text-left text-brand-graphite hover:text-brand-green dark:text-white">
                      <span className="block h-12 w-20 shrink-0 overflow-hidden rounded-md">
                        <Img photo={c.poster} alt="" className="h-full w-full object-cover" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{c.title}</span>
                        <span className="block truncate text-xs text-gray-500">{c.advertiser}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Offre de diffusion */}
            <div className="rounded-2xl bg-brand-orange p-5 text-white">
              <p className="text-lg font-bold">{t('home.clips.offerTitle')}</p>
              <p className="mt-1 text-sm text-white/90">
                {t('home.clips.offerText', {
                  ht: formatXOF(CLIP_PRICE_XOF.ht, i18n.resolvedLanguage),
                  ttc: formatXOF(CLIP_PRICE_XOF.ttc, i18n.resolvedLanguage),
                })}
              </p>
              <Link to="/publicite" className="btn mt-4 bg-white text-brand-orange hover:bg-brand-graphite hover:text-white">
                {t('home.clips.offerCta')}
              </Link>
            </div>

            {/* AGAPY TV : espace pour les émissions en direct */}
            <Link to="/publicite" className="group flex items-center gap-4 rounded-2xl border border-brand-green/10 bg-white p-4 text-brand-graphite transition hover:border-brand-green/30 dark:border-white/10 dark:bg-night-card dark:text-white">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-500">
                <Radio className="size-5" />
                <span className="absolute top-1 right-1 size-2.5 animate-pulse rounded-full bg-rose-500 motion-reduce:animate-none" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t('home.clips.tvTitle')}</span>
                <span className="block text-xs text-gray-500">{t('home.clips.tvText')}</span>
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
