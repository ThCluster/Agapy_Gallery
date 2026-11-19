/**
 * Catalogue public (backend : apps/catalog) : artistes, œuvres, recherche, galeries gratuites, cadres.
 * Visites payantes et dons (backend : apps/payments).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type Page } from '@/lib/api'
import { followPaymentAction, type PaymentMethod, type PaymentStarted } from '@/api/payments'
import type { Region } from '@/lib/pricing'

export type ApiDiscipline = 'peinture' | 'photographie' | 'sculpture' | 'autre'

/** Carte d'un artiste (listes, recherche) */
export interface CatalogArtist {
  /** Identifiant public (slug) */
  id: string
  name: string
  discipline: ApiDiscipline | null
  city: string
  country: string
  /** Numéro sur la grande avenue de la ville 3D */
  address: number
  /** Image de l'œuvre en couverture (URL) */
  cover: string | null
  /** Photo de l'artiste (URL) */
  photo: string | null
  free: boolean
  free_until: string | null
  artwork_count: number
}

export interface CatalogArtwork {
  id: string
  title: string
  artist_id: string
  artist_name: string
  summary: string
  technique: string
  discipline: ApiDiscipline
  /** Dimensions en cm : hauteur × largeur */
  size: [number, number]
  height_cm: string
  width_cm: string
  image: string
  excerpt: string | null
  excerpt_duration: number | null
  frame: string
  author_name: string
  copyright_office: string
  is_free: boolean
  recommended: boolean
  team_favorite: boolean
  published_at: string | null
  view_count: number
}

export interface CatalogArtistDetail extends CatalogArtist {
  bio: string
  member_since: number
  copyright_office: string
  visits: number
  socials: { label: string; url: string }[]
  artworks: CatalogArtwork[]
}

export interface SearchResult {
  found: boolean
  code: '' | 'artist_not_found' | 'artwork_not_found' | string
  detail: string
  artists: CatalogArtist[]
  artworks: CatalogArtwork[]
}

export interface Frame {
  id: string
  label: string
}

export interface ArtistFilters {
  q?: string
  discipline?: string
  country?: string
  free?: boolean
  page?: number
  page_size?: number
}

export interface ArtworkFilters {
  q?: string
  artist?: string
  discipline?: string
  recommended?: boolean
  team_favorite?: boolean
  page?: number
  page_size?: number
}

const opts = { auth: false } as const

export const listArtists = (f: ArtistFilters = {}) => api<Page<CatalogArtist>>('/catalog/artists/', { ...opts, query: { ...f, free: f.free ? 'true' : undefined } })
export const getArtist = (slug: string) => api<CatalogArtistDetail>(`/catalog/artists/${encodeURIComponent(slug)}/`, opts)
export const listArtworks = (f: ArtworkFilters = {}) =>
  api<Page<CatalogArtwork>>('/catalog/artworks/', {
    ...opts,
    query: { ...f, recommended: f.recommended ? 'true' : undefined, team_favorite: f.team_favorite ? 'true' : undefined },
  })
export const getArtwork = (slug: string) => api<CatalogArtwork>(`/catalog/artworks/${encodeURIComponent(slug)}/`, opts)
export const listFreeGalleries = (page_size = 24) => api<Page<CatalogArtist>>('/catalog/free-galleries/', { ...opts, query: { page_size } })
export const listFrames = () => api<Frame[]>('/catalog/frames/', opts)
export const search = (params: { q?: string; artist?: string; title?: string }) => api<SearchResult>('/catalog/search/', { ...opts, query: params })

// --- Hooks react-query ------------------------------------------------------------------
const STALE = 60_000

export const useArtists = (f: ArtistFilters = {}) =>
  useQuery({ queryKey: ['catalog', 'artists', f], queryFn: () => listArtists(f), staleTime: STALE, placeholderData: keepPreviousData })

export const useArtist = (slug: string) =>
  useQuery({ queryKey: ['catalog', 'artist', slug], queryFn: () => getArtist(slug), enabled: !!slug, staleTime: STALE, retry: false })

export const useArtworks = (f: ArtworkFilters = {}) =>
  useQuery({ queryKey: ['catalog', 'artworks', f], queryFn: () => listArtworks(f), staleTime: STALE, placeholderData: keepPreviousData })

export const useArtwork = (slug: string) =>
  useQuery({ queryKey: ['catalog', 'artwork', slug], queryFn: () => getArtwork(slug), enabled: !!slug, staleTime: STALE, retry: false })

export const useFreeGalleries = (page_size = 24) =>
  useQuery({ queryKey: ['catalog', 'free-galleries', page_size], queryFn: () => listFreeGalleries(page_size), staleTime: STALE })

export const useFrames = () => useQuery({ queryKey: ['catalog', 'frames'], queryFn: listFrames, staleTime: Infinity })

export const useSearch = (params: { q?: string; artist?: string; title?: string }) =>
  useQuery({
    queryKey: ['catalog', 'search', params],
    queryFn: () => search(params),
    enabled: !!(params.q || params.artist || params.title),
    staleTime: STALE,
    retry: false,
  })

/** Artistes « tendance » : classés par le nombre total de vues de leurs œuvres (l'API ne trie pas les artistes par vues). */
export function useTrendingArtists(count = 6) {
  const artists = useArtists({ page_size: 100 })
  const works = useArtworks({ page_size: 100 })
  const views = new Map<string, number>()
  for (const w of works.data?.results ?? []) views.set(w.artist_id, (views.get(w.artist_id) ?? 0) + w.view_count)
  const data = artists.data
    ? [...artists.data.results].filter((a) => a.cover).sort((a, b) => (views.get(b.id) ?? 0) - (views.get(a.id) ?? 0)).slice(0, count)
    : undefined
  return { data, isPending: artists.isPending, isError: artists.isError }
}

/** Œuvres des galeries actuellement en visite gratuite */
export function useFreeGalleryWorks() {
  const galleries = useFreeGalleries(100)
  const works = useArtworks({ page_size: 100 })
  const free = new Set((galleries.data?.results ?? []).map((a) => a.id))
  const data = galleries.data && works.data ? works.data.results.filter((w) => free.has(w.artist_id)) : undefined
  return { data, galleries: galleries.data?.results, isPending: galleries.isPending || works.isPending, isError: galleries.isError || works.isError }
}

// --- Visites et dons --------------------------------------------------------------------
export interface VisitAccess {
  access: boolean
  free: boolean
  expires_at: string | null
}

export interface Payer {
  payer_name?: string
  payer_email?: string
  payer_phone?: string
}

/** Galerie gratuite : 200 { access, free } ; sinon 201 { payment, action } */
export const startVisit = (body: { artist: string; method: PaymentMethod; region: Region } & Payer) =>
  api<VisitAccess | PaymentStarted>('/payments/visits/', { method: 'POST', body, auth: false })

export const checkVisitAccess = (artist: string, token: string | null) =>
  api<VisitAccess>('/payments/visits/access/', { query: { artist }, headers: token ? { 'X-Visit-Token': token } : {}, auth: false })

export const startDonation = (body: { artist: string; amount: number; region: Region; method: PaymentMethod; message?: string } & Payer) =>
  api<PaymentStarted>('/payments/donations/', { method: 'POST', body, auth: false })

export const isPaymentStarted = (r: VisitAccess | PaymentStarted): r is PaymentStarted => 'payment' in r

/** Don à faire après le paiement de la visite (deux paiements successifs) */
export const PENDING_DONATION_KEY = 'agapy-pending-donation'

export interface PendingDonation {
  artist: string
  amount: number
  method: PaymentMethod
  region: Region
}

export function takePendingDonation(artist: string): PendingDonation | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_DONATION_KEY) ?? 'null') as PendingDonation | null
    sessionStorage.removeItem(PENDING_DONATION_KEY)
    return saved?.artist === artist ? saved : null
  } catch {
    return null
  }
}

/** Lance un don ; renvoie true s'il est déjà confirmé (sinon redirection vers le paiement) */
export async function sendDonation(d: PendingDonation): Promise<boolean> {
  const started = await startDonation({ artist: d.artist, amount: d.amount, region: d.region, method: d.method })
  return followPaymentAction(started, `/artistes/${d.artist}`)
}

/** Proportions d'une œuvre à partir de ses dimensions (hauteur × largeur, en cm) */
export const workRatio = (w: Pick<CatalogArtwork, 'size'>) => {
  const [h, wd] = w.size
  return h > 0 && wd > 0 ? { width: wd, height: h } : { width: 4, height: 5 }
}
