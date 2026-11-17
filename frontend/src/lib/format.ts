export function formatXOF(amount: number, locale = 'fr'): string {
  return `${formatNumber(amount, locale)} F CFA`
}

const NARROW_NBSP = new RegExp(String.fromCharCode(0x202f), 'g')
const NBSP = String.fromCharCode(0xa0)

/**
 * Nombre avec séparateur de milliers toujours affiché (1 500 et non 1500).
 * L'espace fine du français est remplacée par une espace insécable classique,
 * car l'espace fine est presque invisible dans la police Plus Jakarta Sans.
 */
export function formatNumber(value: number, locale = 'fr'): string {
  return new Intl.NumberFormat(locale, { useGrouping: 'always' }).format(value).replace(NARROW_NBSP, NBSP)
}

export function formatSize([h, w]: [number, number]): string {
  return `${h} × ${w} cm`
}
