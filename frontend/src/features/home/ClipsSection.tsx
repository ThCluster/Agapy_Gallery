import { ChevronLeft, ChevronRight, Film, Pause, Play, Radio } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLiveClips, useLiveTv } from '@/api/promotions'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { formatXOF } from '@/lib/format'
import { CLIP_PRICE_XOF } from '@/lib/pricing'

/** Durée maximale d'un clip, et nombre de clips diffusés en boucle sur 24 h */
const CLIP_SECONDS = 30
const MAX_CLIPS = 50

/** Clip à l'affiche (API) */
interface Item {
  id: string
  title: string
  advertiser: string
  video: string
  poster?: string | null
}

/**
 * Espace des clips publicitaires : chaque clip passe 30 s puis le suivant
 * démarre automatiquement, en boucle. À côté : la file d'attente,
 * l'offre de diffusion et l'espace « AGAPY TV » pour les directs.
 */
export function ClipsSection() {
  const { t, i18n } = useTranslation()
  const { data: live } = useLiveClips()
  const { data: tv } = useLiveTv()
  // Clips en diffusion ; sans clip payé, un emplacement « Votre clip ici »
  const clips: Item[] = (live ?? []).map((c) => ({ id: `api-${c.id}`, title: c.title, advertiser: c.advertiser, video: c.video, poster: c.poster }))
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const safeIndex = clips.length ? index % clips.length : 0
  const clip = clips[safeIndex] as Item | undefined
  const go = (dir: 1 | -1) => {
    if (!clips.length) return
    setProgress(0)
    setIndex((i) => (i + dir + clips.length) % clips.length)
  }
  /** Clip suivant ; un seul clip : il recommence */
  const next = () => {
    const v = videoRef.current
    if (clips.length === 1 && v) {
      v.currentTime = 0
      setProgress(0)
      void v.play()
    } else go(1)
  }
  const upNext = clips.length > 1 ? [1, 2, 3].slice(0, clips.length - 1).map((n) => clips[(safeIndex + n) % clips.length]) : []
  const total = clips.length

  // Lecture / pause de la vidéo réelle
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (paused) v.pause()
    else v.play().catch(() => setPaused(true))
  }, [paused, clip?.id])

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
                {clip ? (
                  <>
                    <video
                      key={clip.id}
                      ref={videoRef}
                      src={clip.video}
                      poster={clip.poster ?? undefined}
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                      onEnded={next}
                      onTimeUpdate={(e) => {
                        const v = e.currentTarget
                        // 30 s au plus par clip, même si la vidéo est plus longue
                        const length = Math.min(v.duration || CLIP_SECONDS, CLIP_SECONDS)
                        setProgress(Math.min(1, v.currentTime / length))
                        if (v.currentTime >= CLIP_SECONDS && !v.paused) {
                          v.pause()
                          next()
                        }
                      }}
                      onError={() => {
                        if (clips.length > 1) go(1)
                      }}
                      className="h-full w-full bg-black object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className="absolute top-4 left-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wider uppercase backdrop-blur">
                      {t('home.clips.ad')} · {safeIndex + 1} / {total}
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
                      {clips.length > 1 && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => go(-1)} aria-label={t('common.previous')} className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/30">
                            <ChevronLeft className="size-5" />
                          </button>
                          <button type="button" onClick={() => go(1)} aria-label={t('common.next')} className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/30">
                            <ChevronRight className="size-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <Link to="/publicite" className="group absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-graphite to-brand-green p-6 text-center text-white">
                    <span>
                      <Film className="mx-auto size-10 text-brand-orange" />
                      <span className="mt-4 block text-2xl font-semibold">{t('home.clips.placeholderTitle')}</span>
                      <span className="mt-2 block text-sm text-white/80">{t('home.clips.placeholderText', { max: MAX_CLIPS, seconds: CLIP_SECONDS })}</span>
                      <span className="btn mt-5 inline-flex bg-white text-brand-orange group-hover:bg-brand-orange group-hover:text-white">{t('home.clips.offerCta')}</span>
                    </span>
                  </Link>
                )}
              </div>
              {/* Barre de progression : à la fin des 30 s, le clip suivant démarre tout seul */}
              <div className="h-1 bg-brand-green/10">
                {clip && <div className="h-full origin-left bg-brand-orange" style={{ transform: `scaleX(${progress})` }} />}
              </div>
            </div>
          </Reveal>

          <Reveal className="flex flex-col gap-4">
            {/* À suivre */}
            {upNext.length > 0 && (
            <div className="rounded-2xl border border-brand-green/10 bg-brand-mist p-4 dark:border-white/10 dark:bg-night-card">
              <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-gray-500 uppercase">{t('home.clips.next')}</p>
              <ul className="space-y-3">
                {upNext.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setProgress(0)
                        setIndex(clips.indexOf(c))
                      }}
                      className="flex w-full items-center gap-3 rounded-lg text-left text-brand-graphite hover:text-brand-green dark:text-white">
                      <span className="block h-12 w-20 shrink-0 overflow-hidden rounded-md">
                        {c.poster ? (
                          <img src={c.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center bg-brand-graphite text-white/70">
                            <Play className="size-4" />
                          </span>
                        )}
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
            )}

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
            <Link to="/publicite#tv" className="group flex items-center gap-4 rounded-2xl border border-brand-green/10 bg-white p-4 text-brand-graphite transition hover:border-brand-green/30 dark:border-white/10 dark:bg-night-card dark:text-white">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-500">
                <Radio className="size-5" />
                <span className="absolute top-1 right-1 size-2.5 animate-pulse rounded-full bg-rose-500 motion-reduce:animate-none" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t('home.clips.tvTitle')}</span>
                <span className="block text-xs text-gray-500">{tv?.live ? `${t('static.ads.live')} · ${tv.live.title}` : t('home.clips.tvText')}</span>
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
