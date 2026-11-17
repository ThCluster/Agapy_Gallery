import type { Artwork, Discipline } from '@/types/catalog'

/** Discipline d'une œuvre, déduite de sa technique */
export function disciplineOf(work: Artwork): Discipline {
  const tech = work.technique.toLowerCase()
  if (tech.includes('photo')) return 'photographie'
  if (tech.includes('sculpture')) return 'sculpture'
  return 'peinture'
}
