/**
 * Redirections internes : n'accepte qu'un chemin du site (« /… »), jamais une autre origine.
 * Refuse « //hote », « /\hote », les barres obliques inverses, les caractères de contrôle
 * et tout ce qui changerait d'origine une fois résolu.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f\\]/

export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || FORBIDDEN.test(value)) return fallback
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
