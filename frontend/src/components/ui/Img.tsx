import { photos, type PhotoKey } from '@/mocks/photos'

interface Props {
  /** Photo locale (mocks) */
  photo?: PhotoKey
  /** Ou URL d'une image (renvoyée par l'API, ex. /media/...) ; prioritaire sur `photo` */
  src?: string | null
  alt: string
  className?: string
  /** Image visible dès l'arrivée sur la page : chargée en priorité */
  priority?: boolean
  sizes?: string
  width?: number
  height?: number
}

/**
 * Image optimisée : dimensions connues (pas de saut de mise en page),
 * chargement différé hors écran, décodage sans bloquer la page.
 */
export function Img({ photo, src, alt, className = '', priority = false, sizes, width, height }: Props) {
  const p = photo ? photos[photo] : undefined
  const url = src || p?.src
  if (!url) return <span role="img" aria-label={alt} className={`block bg-brand-mist dark:bg-night-card ${className}`} />
  return (
    <img
      src={url}
      width={width ?? (src ? undefined : p?.width)}
      height={height ?? (src ? undefined : p?.height)}
      alt={alt}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  )
}
