/** Texte comparable : minuscules, sans accents ni ponctuation superflue */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distance d'édition (Levenshtein), pour proposer des noms proches en cas de faute de frappe */
export function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Vrai si tous les mots de la recherche apparaissent dans le texte */
export function matches(text: string, query: string): boolean {
  const t = normalize(text)
  return normalize(query)
    .split(' ')
    .filter(Boolean)
    .every((word) => t.includes(word))
}

/** Les éléments dont le libellé ressemble le plus à la recherche (suggestions « Vouliez-vous dire… ») */
export function closest<T>(items: T[], label: (item: T) => string, query: string, max = 3): T[] {
  const q = normalize(query)
  return items
    .map((item) => {
      const words = normalize(label(item)).split(' ')
      const score = Math.min(distance(normalize(label(item)), q), ...words.map((w) => distance(w, q)))
      return { item, score }
    })
    .filter(({ score }) => score <= Math.max(2, Math.floor(q.length / 3)))
    .sort((a, b) => a.score - b.score)
    .slice(0, max)
    .map(({ item }) => item)
}
