/**
 * Client de l'API Django (/api/v1, servie par le proxy Vite en développement).
 *
 * - Le jeton d'accès reste en mémoire (store auth), jamais dans localStorage.
 * - Le jeton de rafraîchissement est un cookie HttpOnly : on envoie `credentials: 'include'`.
 * - Sur un 401, un seul rafraîchissement à la fois (promesse partagée), puis la requête est rejouée :
 *   deux rafraîchissements simultanés avec le même cookie déconnecteraient l'utilisateur.
 * - Les erreurs portent `codes` : le texte affiché vient de la traduction `errors.<code>`.
 */
import i18n from '@/i18n'

export const API_BASE = '/api/v1'

export type Codes = Record<string, string | string[] | Record<string, unknown>>

export class ApiError extends Error {
  status: number
  /** Corps de la réponse : { champ: [messages] } ou { detail } */
  data: Record<string, unknown>
  codes: Codes

  constructor(status: number, data: Record<string, unknown>) {
    super(typeof data.detail === 'string' ? data.detail : `Erreur ${status}`)
    this.status = status
    this.data = data
    this.codes = (data.codes as Codes) ?? {}
  }

  /** Premier code d'erreur d'un champ (ou de `detail`) */
  code(field = 'detail'): string | undefined {
    const c = this.codes[field]
    if (typeof c === 'string') return c
    if (Array.isArray(c)) return c[0]
    return undefined
  }

  /** Champs en erreur, pour react-hook-form : { champ: code } */
  fieldCodes(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const key of Object.keys(this.codes)) {
      const c = this.code(key)
      if (c) out[key] = c
    }
    return out
  }
}

/** Message traduit d'une erreur d'API (repli : message du serveur, puis message générique) */
export function errorMessage(error: unknown, field = 'detail'): string {
  if (error instanceof ApiError) {
    const code = error.code(field) ?? Object.values(error.fieldCodes())[0]
    if (code && i18n.exists(`errors.${code}`)) return i18n.t(`errors.${code}`)
    const raw = error.data[field]
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
    return i18n.t('errors.generic')
  }
  return i18n.t('errors.network')
}

// --- Jeton d'accès (fourni par stores/auth.ts) ------------------------------------------
type TokenBridge = { get: () => string | null; refresh: () => Promise<boolean> }
let bridge: TokenBridge = { get: () => null, refresh: async () => false }

export function setTokenBridge(b: TokenBridge) {
  bridge = b
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** Objet envoyé en JSON, ou FormData (multipart, pour les fichiers) */
  body?: unknown
  /** Paramètres d'URL (les valeurs vides sont ignorées) */
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  /** false : n'envoie pas le jeton d'accès et ne tente pas de rafraîchissement */
  auth?: boolean
  signal?: AbortSignal
}

/**
 * Adresse de l'API : uniquement des chemins relatifs du site (« /api/… » ou relatifs à /api/v1).
 * Les URL absolues sont refusées : le jeton d'accès ne doit jamais partir vers une autre origine.
 */
function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || path.includes('\\')) {
    throw new Error(`Adresse d'API refusée : ${path}`)
  }
  const url = path.startsWith('/api/') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
}

async function send(url: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': i18n.language || 'fr', ...opts.headers }
  let body: BodyInit | undefined
  if (opts.body instanceof FormData) body = opts.body
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  // Le jeton n'accompagne que les appels à notre API (chemin relatif /api/…)
  if (token && url.startsWith('/api/')) headers.Authorization = `Bearer ${token}`
  return fetch(url, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'include', signal: opts.signal })
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth !== false
  const url = buildUrl(path, opts.query)
  const sentToken = useAuth ? bridge.get() : null
  let res = await send(url, opts, sentToken)
  if (res.status === 401 && useAuth && sentToken) {
    const current = bridge.get()
    if (current && current !== sentToken) {
      // Jeton déjà renouvelé entre-temps (autre requête) : on rejoue sans nouveau rafraîchissement
      res = await send(url, opts, current)
    } else if (current && (await bridge.refresh())) {
      res = await send(url, opts, bridge.get())
    }
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data as Record<string, unknown>)
  return data as T
}

/** Réponse paginée de DRF */
export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Montants : l'API les envoie en chaînes ("12000.00") */
export const toNumber = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v))

/** Construit un FormData à partir d'un objet (ignore undefined, convertit booléens et nombres) */
export function toFormData(values: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue
    if (v instanceof Blob) fd.append(k, v)
    else fd.append(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v))
  }
  return fd
}
