/**
 * Catalogue public (backend : apps/catalog) : artistes, œuvres, recherche, galeries gratuites, cadres.
 * Visites payantes et dons (backend : apps/payments).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type Page } from '@/lib/api'
import { followPaymentAction, getVisitToken, type PaymentMethod, type PaymentStarted } from '@/api/payments'
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
  /** Visites réelles de la galerie */
  visits?: number
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
  /** Tri côté API : -visits (visites réelles), -views (vues des œuvres) */
  ordering?: '-visits' | '-views'
  page?: number
  page_size?: number
}

export interface ArtworkFilters {
  q?: string
  artist?: string
  discipline?: string
  recommended?: boolean
  team_favorite?: boolean
  /** Œuvres des galeries actuellement en visite gratuite */
  free_gallery?: boolean
  page?: number
  page_size?: number
}

const opts = { auth: false } as const

export const listArtists = (f: ArtistFilters = {}) => api<Page<CatalogArtist>>('/catalog/artists/', { ...opts, query: { ...f, free: f.free ? 'true' : undefined } })
export const getArtist = (slug: string) => api<CatalogArtistDetail>(`/catalog/artists/${encodeURIComponent(slug)}/`, opts)
export const listArtworks = (f: ArtworkFilters = {}) =>
  api<Page<CatalogArtwork>>('/catalog/artworks/', {
    ...opts,
    query: {
      ...f,
      recommended: f.recommended ? 'true' : undefined,
      team_favorite: f.team_favorite ? 'true' : undefined,
      free_gallery: f.free_gallery ? 'true' : undefined,
    },
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

/** Artistes « tendance » : les plus visités (tri par l'API) */
export function useTrendingArtists(count = 6) {
  const artists = useArtists({ ordering: '-visits', page_size: count * 2 })
  const data = artists.data ? artists.data.results.filter((a) => a.cover).slice(0, count) : undefined
  return { data, isPending: artists.isPending, isError: artists.isError }
}

/** Œuvres des galeries actuellement en visite gratuite */
export function useFreeGalleryWorks(page_size = 48) {
  const galleries = useFreeGalleries(24)
  const works = useArtworks({ free_gallery: true, page_size })
  return { data: works.data?.results, galleries: galleries.data?.results, isPending: galleries.isPending || works.isPending, isError: galleries.isError || works.isError }
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

/**
 * Droit de visite : une galerie gratuite est ouverte sans appel (pour ne pas compter une visite
 * à chaque affichage) ; une galerie payante exige un jeton de visite encore valide.
 */
export function useVisitAccess(artist: Pick<CatalogArtist, 'id' | 'free'> | undefined) {
  const slug = artist?.id ?? ''
  const token = slug ? getVisitToken(slug) : null
  const query = useQuery({
    queryKey: ['visit-access', slug],
    queryFn: () => checkVisitAccess(slug, getVisitToken(slug)),
    // Sans jeton, inutile d'interroger l'API : pas d'accès
    enabled: !!artist && !artist.free && !!token,
    staleTime: 60_000,
    retry: false,
  })
  const hasAccess = !!artist && (artist.free || !!query.data?.access)
  return { hasAccess, isChecking: !!artist && !artist.free && !!token && query.isPending, refetch: query.refetch }
}

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
