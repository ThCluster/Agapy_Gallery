import { Music } from 'lucide-react'
import type { SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'

/** Durée maximale d'un extrait (cahier des charges : 30 secondes) */
export const EXCERPT_MAX_SECONDS = 30

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i

/** Arrête la lecture à 30 s, même si le fichier est plus long */
function stopAt30(e: SyntheticEvent<HTMLMediaElement>) {
  const el = e.currentTarget
  if (el.currentTime >= EXCERPT_MAX_SECONDS) {
    el.pause()
    el.currentTime = EXCERPT_MAX_SECONDS
  }
}

/** Lecteur de l'extrait audio ou vidéo d'une œuvre (30 s au plus) */
export function ExcerptPlayer({ src, title, className = '' }: { src: string; title: string; className?: string }) {
  const { t } = useTranslation()
  const isVideo = VIDEO_EXT.test(src)
  return (
    <figure className={`rounded-2xl border border-brand-graphite/10 p-4 dark:border-white/10 ${className}`}>
      <figcaption className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
        <Music className="size-4 text-brand-green" /> {t('catalog.excerpt.title')}
      </figcaption>
      {isVideo ? (
        <video src={src} controls preload="metadata" playsInline onTimeUpdate={stopAt30} className="w-full rounded-xl bg-black" aria-label={title}>
          {t('catalog.excerpt.unsupported')}
        </video>
      ) : (
        <audio src={src} controls preload="metadata" onTimeUpdate={stopAt30} className="w-full" aria-label={title}>
          {t('catalog.excerpt.unsupported')}
        </audio>
      )}
    </figure>
  )
}
