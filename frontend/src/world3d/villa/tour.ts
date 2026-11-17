import { TEMPLATES, type Slot, type Template, type Vec3 } from './templates'
import type { Hanging, VillaConfig } from './types'

export interface Stop {
  /** Position de la caméra (yeux du visiteur) */
  eye: Vec3
  /** Point regardé */
  look: Vec3
  /** Œuvre commentée à cet arrêt (aucune pour l'entrée et la vue d'ensemble) */
  hanging?: Hanging
  /** Où se tient l'avatar-guide */
  guide: Vec3
}

const EYE = 1.65

/** Position de la caméra face à un emplacement, à bonne distance */
function facing(t: Template, s: Slot, hanging: Hanging): Stop {
  const L = t.room.length / 2
  const D = t.room.depth / 2
  // Le regard vise un peu sous le centre de la toile : elle apparaît au-dessus du panneau du guide
  const y = 1.8
  if (s.wall === 'back') return { eye: [s.at, EYE, -D + 4.6], look: [s.at, y, -D], hanging, guide: [s.at - 1.6, 0, -D + 1.4] }
  if (s.wall === 'front') return { eye: [s.at, EYE, D - 4.6], look: [s.at, y, D], hanging, guide: [s.at + 1.6, 0, D - 1.4] }
  return { eye: [-L + 5.2, EYE, s.at], look: [-L, y + 0.3, s.at], hanging, guide: [-L + 1.6, 0, s.at - 2.4] }
}

/** La visite guidée : entrée par le jardin, arrêt devant chaque œuvre, vue d'ensemble */
export function buildTour(villa: VillaConfig): Stop[] {
  const t = TEMPLATES[villa.template]
  const order = villa.tour ?? villa.hangings.map((h) => h.slot)
  const stops = order.flatMap((slotId) => {
    const slot = t.slots.find((s) => s.id === slotId)
    const hanging = villa.hangings.find((h) => h.slot === slotId)
    return slot && hanging ? [facing(t, slot, hanging)] : []
  })
  return [{ ...t.entry }, ...stops, { ...t.overview }]
}
