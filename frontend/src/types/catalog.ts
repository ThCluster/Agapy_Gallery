import type { PhotoKey } from '@/mocks/photos'

export type Discipline = 'peinture' | 'photographie' | 'sculpture'

export interface Artist {
  id: string
  name: string
  discipline: Discipline
  city: string
  country: string
  /** Numéro sur la grande avenue de la ville 3D */
  address: number
  /** Œuvre affichée en couverture */
  cover: PhotoKey
  /** Galerie en visite gratuite (choix de l'artiste, modifiable à tout moment) */
  free?: boolean
  /** Fin de la gratuité (AAAA-MM-JJ) : la gratuité peut être limitée dans le temps */
  freeUntil?: string
}

export interface Artwork {
  id: string
  title: string
  artistId: string
  technique: string
  /** Dimensions en cm : hauteur × largeur */
  size: [number, number]
  photo: PhotoKey
  recommended?: boolean
}

export interface Interview {
  id: string
  artistId: string
  role: string
  portrait: PhotoKey
}

export interface Clip {
  id: string
  title: string
  advertiser: string
  poster: PhotoKey
}
