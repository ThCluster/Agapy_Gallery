import i18n from '@/i18n'
import { ApiError } from '@/lib/api'

/**
 * Erreurs par champ renvoyées par l'API, sous forme de clés de traduction pour `<Field error>` :
 * `errors.<code>` quand la traduction existe, sinon un message générique.
 * `map` renomme les champs de l'API vers ceux du formulaire.
 */
export function apiFieldErrors(error: unknown, map: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {}
  if (!(error instanceof ApiError)) return out
  for (const [field, code] of Object.entries(error.fieldCodes())) {
    if (field === 'detail' || field === 'non_field_errors') continue
    const key = `errors.${code}`
    out[map[field] ?? field] = i18n.exists(key) ? key : code === 'blank' || code === 'null' ? 'errors.required' : 'errors.generic'
  }
  return out
}
