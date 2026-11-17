import type { DayLight, TemplateId, Wall, WallTone } from './types'

export type Vec3 = [number, number, number]

/** Un emplacement d'accrochage sur un mur du modèle */
export interface Slot {
  id: string
  wall: Wall
  /** Position le long du mur (x pour les murs avant et arrière, z pour le mur du fond) */
  at: number
  /** Largeur de toile affichée, en mètres */
  minWidth: number
  maxWidth: number
  /** Emplacement d'honneur (grand mur du fond) */
  feature?: boolean
}

export interface Template {
  id: TemplateId
  name: string
  room: { length: number; depth: number; height: number }
  slots: Slot[]
  /** Arrivée par le jardin et vue d'ensemble finale : caméra, regard, guide */
  entry: { eye: Vec3; look: Vec3; guide: Vec3 }
  overview: { eye: Vec3; look: Vec3; guide: Vec3 }
}

/**
 * Modèle « Lagune » : un hall de 28 m (x de -14 à 14) sur 12 m (z de -6 à 6), 7 m sous verrière,
 * façade vitrée sur le jardin en x = 14. Sept emplacements, dont un mur d'honneur au fond.
 */
const LAGUNE: Template = {
  id: 'lagune',
  name: 'Lagune',
  room: { length: 28, depth: 12, height: 7 },
  slots: [
    { id: 'back-1', wall: 'back', at: 7.5, minWidth: 1.4, maxWidth: 2.2 },
    { id: 'back-2', wall: 'back', at: 1.5, minWidth: 1.4, maxWidth: 2.2 },
    { id: 'back-3', wall: 'back', at: -4.5, minWidth: 1.4, maxWidth: 2.2 },
    { id: 'honneur', wall: 'left', at: 0, minWidth: 3, maxWidth: 3.6, feature: true },
    { id: 'front-3', wall: 'front', at: -4.5, minWidth: 1.4, maxWidth: 2.2 },
    { id: 'front-2', wall: 'front', at: 1.5, minWidth: 1.4, maxWidth: 2.2 },
    { id: 'front-1', wall: 'front', at: 7.5, minWidth: 1.4, maxWidth: 2.2 },
  ],
  entry: { eye: [18.5, 1.7, 1.2], look: [4, 1.9, 0], guide: [11, 0, 1] },
  overview: { eye: [11, 3.2, 4.5], look: [-6, 1.6, -1.5], guide: [8, 0, 0.5] },
}

export const TEMPLATES: Record<TemplateId, Template> = { lagune: LAGUNE }

/** Couleur des murs pour chaque teinte proposée */
export const WALL_TONES: Record<WallTone, string> = {
  blanc: '#f6f4ef',
  lin: '#efe7da',
  argile: '#eddccc',
  sauge: '#e4e9de',
}

/** Soleil et ciel selon l'heure choisie par l'artiste */
export const DAYLIGHTS: Record<DayLight, { sun: Vec3; color: string; intensity: number; sky: number; ground: string }> = {
  matin: { sun: [18, 14, 10], color: '#ffe8cc', intensity: 2.9, sky: 0.75, ground: '#cdb89d' },
  midi: { sun: [9, 22, 6], color: '#fff4e2', intensity: 3.2, sky: 0.8, ground: '#c9b49a' },
  soir: { sun: [22, 8, -8], color: '#ffc493', intensity: 2.5, sky: 0.65, ground: '#c7a588' },
}

/** Agrandissement de présentation : dans un hall de 28 m, la taille réelle paraît minuscule */
const DISPLAY_SCALE = 1.6

/** Largeur affichée d'une toile (m) à partir de sa largeur réelle (cm), bornée par l'emplacement */
export function displayWidth(slot: Slot, widthCm: number): number {
  return Math.min(slot.maxWidth, Math.max(slot.minWidth, (widthCm / 100) * DISPLAY_SCALE))
}
