/** Le compteur affiche au minimum 1 500 et ne grimpe qu'à partir de la 1 501ᵉ inscription. */
export const ARTIST_COUNTER_FLOOR = 1500

export function displayedArtistCount(realCount: number): number {
  return Math.max(ARTIST_COUNTER_FLOOR, realCount)
}
