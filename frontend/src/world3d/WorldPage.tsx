import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { ArrowLeft, ChevronLeft, ChevronRight, Gift, Move3d, Pause, Play, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { Suspense, use, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router'
import { useVisitAccess } from '@/api/catalog'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { buildTour } from './villa/tour'
import type { VillaConfig } from './villa/types'
import { VillaScene, type Quality } from './villa/VillaScene'
import { getVilla, getVillaOfTheWeek } from './villa/villas'

/** Durée d'un arrêt pendant la visite automatique */
const STOP_MS = 11_000

/** Écran d'attente pendant le chargement des matériaux, du ciel et des modèles */
function LoadingScreen({ waiting = false }: { waiting?: boolean }) {
  const { t } = useTranslation()
  const { active, progress: loaded } = useProgress()
  const progress = waiting ? 0 : loaded
  if (!waiting && !active && loaded >= 100) return null
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[#f4f7f5]">
      <div className="w-64 text-center">
        <p className="font-logo text-xl font-extrabold text-brand-green">
          Agapy<span className="text-brand-orange">-</span>gallery
        </p>
        <p className="mt-4 text-sm text-brand-ink">{t('world.loading')}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-green/10">
          <div className="h-full rounded-full bg-brand-green transition-[width] duration-300" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-500 tabular-nums">{Math.round(progress)} %</p>
      </div>
    </div>
  )
}

/** Villa introuvable ou sans œuvre accrochée */
function NoVilla() {
  const { t } = useTranslation()
  return (
    <div className="grid h-dvh place-items-center bg-[#f4f7f5] p-6 text-center">
      <div className="max-w-md">
        <p className="text-xl font-semibold text-brand-graphite">{t('world.noVilla')}</p>
        <p className="mt-2 text-sm text-gray-500">{t('world.noVillaHint')}</p>
        <Link to="/artistes" className="btn-primary mt-6 rounded-full px-6 py-3">
          {t('world.seeArtists')}
        </Link>
      </div>
    </div>
  )
}

/**
 * La villa d'un artiste en 3D réaliste : /ville/:artistId (ou la villa de la semaine sur /ville).
 * Le moteur est commun ; la fiche de villa (murs, lumière, accrochage, commentaires) vient de l'artiste.
 */
export default function WorldPage() {
  const { artistId } = useParams()
  return (
    <Suspense fallback={<LoadingScreen waiting />}>
      {artistId ? <Visit key={artistId} artistId={artistId} /> : <WeeklyVisit />}
    </Suspense>
  )
}

/** /ville sans artiste : la villa la plus visitée */
function WeeklyVisit() {
  const artistId = use(getVillaOfTheWeek())
  return <Visit key={artistId} artistId={artistId} />
}

function Visit({ artistId }: { artistId: string }) {
  const villa = use(getVilla(artistId))
  return villa ? <GuardedVisit villa={villa} /> : <NoVilla />
}

/** Galerie payante : on n'entre qu'avec un droit de visite valide, sinon retour à l'offre de visite */
function GuardedVisit({ villa }: { villa: VillaConfig }) {
  const { t } = useTranslation()
  const access = useVisitAccess({ id: villa.artistId, free: villa.free ?? false })
  useDocumentTitle(t('world.villa', { name: villa.artistName }))
  if (access.isChecking) return <LoadingScreen waiting />
  if (!access.hasAccess) return <Navigate to={`/artistes/${encodeURIComponent(villa.artistId)}#support`} replace />
  return <VillaVisit villa={villa} />
}

function VillaVisit({ villa }: { villa: VillaConfig }) {
  const { t } = useTranslation()
  const [tour] = useState(() => buildTour(villa))
  const [stop, setStop] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [free, setFree] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [quality, setQuality] = useState<Quality>('high')

  const current = tour[stop]
  const work = current.hanging
  const isFirst = stop === 0
  const isLast = stop === tour.length - 1
  const name = villa.artistName
  const first = name.split(' ')[0]
  const speech = work
    ? (work.comment ?? t('world.autoComment', { title: work.title }))
    : isFirst
      ? (villa.welcome ?? t('world.welcome', { name }))
      : (villa.goodbye ?? t('world.goodbye'))

  // Visite automatique : arrêt suivant toutes les quelques secondes
  useEffect(() => {
    if (!playing || free || isLast) return
    const id = window.setTimeout(() => setStop((s) => Math.min(s + 1, tour.length - 1)), STOP_MS)
    return () => window.clearTimeout(id)
  }, [playing, free, stop, isLast, tour.length])

  // Lecture vocale du commentaire du guide (voix du navigateur, en français)
  useEffect(() => {
    if (!voiceOn || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(speech)
    u.lang = 'fr-FR'
    u.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    return () => window.speechSynthesis.cancel()
  }, [voiceOn, speech])

  const go = (dir: 1 | -1) => setStop((s) => Math.max(0, Math.min(tour.length - 1, s + dir)))
  const pill = 'grid size-11 place-items-center rounded-full bg-white/90 text-brand-graphite shadow-md backdrop-blur transition hover:bg-white disabled:opacity-40'

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#f4f7f5]">
      <Canvas style={{ position: 'absolute', inset: 0 }} shadows dpr={quality === 'high' ? [1, 1.75] : 1} camera={{ fov: 50, near: 0.05, far: 300, position: tour[0].eye }} gl={{ antialias: quality === 'low' }}>
        {/* Qualité réduite automatiquement si l'appareil n'arrive pas à suivre */}
        <PerformanceMonitor onDecline={() => setQuality('low')} />
        <Suspense fallback={null}>
          <VillaScene villa={villa} tour={tour} stop={stop} free={free} quality={quality} />
        </Suspense>
      </Canvas>
      <LoadingScreen />

      {/* Barre du haut */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
        <Link to="/" className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-brand-graphite shadow-md backdrop-blur hover:bg-white">
          <ArrowLeft className="size-4" /> {t('world.back')}
        </Link>
        <div className="pointer-events-auto rounded-2xl bg-white/90 px-4 py-2 text-right shadow-md backdrop-blur">
          <p className="text-sm font-semibold text-brand-graphite">{t('world.villa', { name })}</p>
          <p className="text-xs text-gray-500">{t('world.address', { n: villa.address })}</p>
        </div>
      </div>

      {/* Commentaire du guide et commandes */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-6">
        <div className="pointer-events-auto mx-auto max-w-3xl rounded-3xl bg-white/92 p-4 shadow-[0_20px_60px_-25px_rgb(0_0_0/0.5)] backdrop-blur-xl sm:p-5">
          {!free && (
            <div key={stop} className="animate-[agapy-fade-in_0.6s_ease-out]">
              {work ? (
                <>
                  <p className="text-lg font-semibold text-brand-graphite">{work.title}</p>
                  <p className="text-xs text-gray-500">
                    {work.technique}, {work.size[0]} × {work.size[1]} cm
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-brand-graphite">{isFirst ? t('world.welcomeTitle') : t('world.goodbyeTitle')}</p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-brand-ink">
                <span className="font-semibold text-brand-orange">{t('world.guide', { name: first })} </span>« {speech} »
              </p>
              {isLast && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/artistes/${villa.artistId}#support`} className="btn-action rounded-full px-4 py-2 text-sm">
                    <Gift className="size-4" /> {t('artist.support.donate')}
                  </Link>
                  <button type="button" onClick={() => setStop(0)} className="btn-secondary rounded-full px-4 py-2 text-sm">
                    {t('world.restart')}
                  </button>
                </div>
              )}
            </div>
          )}
          {free && <p className="text-sm text-brand-ink">{t('world.freeHint')}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => go(-1)} disabled={free || isFirst} className={pill} aria-label={t('common.previous')}>
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => setPlaying((p) => !p)} disabled={free} className={pill} aria-label={playing ? t('world.pause') : t('world.play')}>
              {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
            </button>
            <button type="button" onClick={() => go(1)} disabled={free || isLast} className={pill} aria-label={t('common.next')}>
              <ChevronRight className="size-5" />
            </button>
            {/* Progression de la visite */}
            <div className="mx-1 flex flex-1 items-center gap-1" aria-hidden>
              {tour.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= stop ? 'bg-brand-green' : 'bg-brand-green/15'}`} />
              ))}
            </div>
            <button type="button" onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn} className={pill} aria-label={voiceOn ? t('world.voiceOff') : t('world.voiceOn')} title={voiceOn ? t('world.voiceOff') : t('world.voiceOn')}>
              {voiceOn ? <Volume2 className="size-5 text-brand-green" /> : <VolumeX className="size-5" />}
            </button>
            <button type="button" onClick={() => setFree((f) => !f)} aria-pressed={free} className={`${pill} ${free ? 'ring-2 ring-brand-green' : ''}`} aria-label={t('world.free')} title={t('world.free')}>
              <Move3d className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setQuality((q) => (q === 'high' ? 'low' : 'high'))}
              className={`${pill} ${quality === 'high' ? 'ring-2 ring-brand-orange' : ''}`}
              aria-label={quality === 'high' ? t('world.qualityHigh') : t('world.qualityLow')}
              title={quality === 'high' ? t('world.qualityHigh') : t('world.qualityLow')}
            >
              <Sparkles className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
