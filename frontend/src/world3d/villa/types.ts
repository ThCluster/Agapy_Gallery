import type { PhotoKey } from '@/mocks/photos'

/**
 * Fiche de villa : tout ce que l'artiste règle depuis son espace « Ma villa ».
 * Le moteur 3D est le même pour tous ; seule cette fiche change d'une villa à l'autre.
 * Elle sera servie par Django : GET /api/villas/<artistId>/
 */

/** Modèles d'architecture disponibles (d'autres viendront : atelier, patio…) */
export type TemplateId = 'lagune'

/** Murs sur lesquels on peut accrocher */
export type Wall = 'back' | 'front' | 'left'

export type FrameKind = 'walnut' | 'gold' | 'black' | 'white'

/** Teintes de murs proposées : toutes claires, à la demande du client */
export type WallTone = 'blanc' | 'lin' | 'argile' | 'sauge'

/** Lumière du jour qui entre par la verrière */
export type DayLight = 'matin' | 'midi' | 'soir'

/** Une œuvre accrochée sur un emplacement du modèle */
export interface Hanging {
  /** Emplacement du modèle d'architecture (voir templates.ts) */
  slot: string
  /** Identifiant de l'œuvre dans le catalogue */
  artworkId: string
  title: string
  technique: string
  /** Dimensions réelles en cm : hauteur × largeur */
  size: [number, number]
  photo: PhotoKey
  frame: FrameKind
  /** Commentaire de l'artiste, lu par son guide (texte généré s'il est vide) */
  comment?: string
}

export interface VillaConfig {
  artistId: string
  artistName: string
  /** Numéro sur la grande avenue de la ville */
  address: number
  template: TemplateId
  wallTone: WallTone
  light: DayLight
  hangings: Hanging[]
  /** Ordre de la visite guidée (emplacements) ; par défaut, l'ordre d'accrochage */
  tour?: string[]
  /** Mots d'accueil et d'au revoir de l'artiste (textes par défaut sinon) */
  welcome?: string
  goodbye?: string
  /** Villa générée automatiquement à partir des œuvres publiées */
  auto?: boolean
}
