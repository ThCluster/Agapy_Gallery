import { photos, type PhotoKey } from '@/mocks/photos'

interface Props {
  photo: PhotoKey
  alt: string
  className?: string
  /** Image visible dès l'arrivée sur la page : chargée en priorité */
  priority?: boolean
  sizes?: string
}

/**
 * Image optimisée : dimensions connues (pas de saut de mise en page),
 * chargement différé hors écran, décodage sans bloquer la page.
 */
export function Img({ photo, alt, className = '', priority = false, sizes }: Props) {
  const p = photos[photo]
  return (
    <img
      src={p.src}
      width={p.width}
      height={p.height}
      alt={alt}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  )
}
