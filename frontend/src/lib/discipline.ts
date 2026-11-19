import type { CatalogArtwork } from '@/api/catalog'
import type { Discipline } from '@/types/catalog'

/** Discipline d'une œuvre : celle renvoyée par l'API, sinon déduite de sa technique */
export function disciplineOf(work: Pick<CatalogArtwork, 'technique'> & { discipline?: string | null }): Discipline {
  if (work.discipline === 'peinture' || work.discipline === 'photographie' || work.discipline === 'sculpture') return work.discipline
  const tech = work.technique.toLowerCase()
  if (tech.includes('photo')) return 'photographie'
  if (tech.includes('sculpture')) return 'sculpture'
  return 'peinture'
}
