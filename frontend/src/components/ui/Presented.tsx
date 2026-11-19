import { Img } from '@/components/ui/Img'
import { photos, type PhotoKey } from '@/mocks/photos'
import type { Discipline } from '@/types/catalog'

/** Présentation d'une œuvre selon la discipline : toile encadrée, tirage photo ou sculpture sur socle. */
interface Props {
  discipline: Discipline | 'autre' | null
  /** Photo locale (mocks) */
  photo?: PhotoKey
  /** Ou image de l'API, avec ses proportions (largeur / hauteur) */
  src?: string | null
  size?: { width: number; height: number }
  alt: string
  large?: boolean
}

export function Presented({ discipline, photo, src, size, alt, large = false }: Props) {
  const ph = size ?? (photo ? photos[photo] : { width: 4, height: 5 })
  const ratio = { aspectRatio: `${ph.width} / ${ph.height}` }

  if (discipline === 'sculpture') {
    return (
      <span className="flex flex-col items-center">
        <span className={`block overflow-hidden rounded-t-sm bg-brand-mist ${large ? 'w-64 sm:w-72' : 'w-full'}`} style={ratio}>
          <Img photo={photo} src={src} alt={alt} className="h-full w-full object-cover" />
        </span>
        {/* Socle blanc */}
        <span className={`block bg-gradient-to-b from-white to-[#ece8e1] shadow-[0_24px_40px_-24px_rgb(30_30_30/0.5)] ${large ? 'h-20 w-72 sm:w-80' : 'h-10 w-[104%]'}`} />
      </span>
    )
  }
  if (discipline === 'photographie') {
    return (
      <span className={`block bg-white p-3 pb-10 shadow-[0_20px_40px_-20px_rgb(30_30_30/0.45)] ${large ? 'w-72 -rotate-2 sm:w-96' : 'w-full'}`}>
        <span className="block overflow-hidden" style={ratio}>
          <Img photo={photo} src={src} alt={alt} className="h-full w-full object-cover" />
        </span>
      </span>
    )
  }
  return (
    <span className={`block border-[#2b2b2b] bg-white shadow-[0_24px_48px_-24px_rgb(30_30_30/0.5)] ${large ? 'w-72 border-[8px] p-6 sm:w-96' : 'w-full border-[5px] p-3'}`}>
      <span className="block overflow-hidden" style={ratio}>
        <Img photo={photo} src={src} alt={alt} className="h-full w-full object-cover" />
      </span>
    </span>
  )
}
