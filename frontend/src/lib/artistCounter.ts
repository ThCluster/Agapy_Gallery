import { useSiteStats } from '@/api/site'

/** Le compteur affiche au minimum 1 500 et ne grimpe qu'à partir de la 1 501ᵉ inscription. */
export const ARTIST_COUNTER_FLOOR = 1500

export function displayedArtistCount(realCount: number): number {
  return Math.max(ARTIST_COUNTER_FLOOR, realCount)
}

/** Nombre d'artistes affiché, lu sur /site/stats/ (plancher déjà appliqué par le serveur) ; plancher en attendant */
export function useArtistCount(): number {
  const { data } = useSiteStats()
  return displayedArtistCount(data?.artist_count ?? 0)
}
