/**
 * Espace artiste : œuvres, galerie, abonnement annuel et Compte d'Avoir.
 * Backend : apps/catalog (me/artworks, me/gallery), apps/subscriptions (me, me/renew, me/wallet).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { api, toFormData, type Page } from '@/lib/api'
import type { FrameId } from '@/features/dashboard/frames'
import { getPayment, type PaymentMethod, type PaymentStarted, type PaymentStatus, type PaymentSummary } from './payments'

export type { FrameId }

// --- Types ---------------------------------------------------------------------------------
export type ArtworkStatus = 'draft' | 'awaiting_payment' | 'pending_review' | 'published' | 'rejected' | 'removed'
export type Discipline = 'peinture' | 'photographie' | 'sculpture' | 'autre'

export interface MyArtwork {
  id: string
  slug: string
  title: string
  summary: string
  technique: string
  discipline: Discipline
  height_cm: string
  width_cm: string
  /** [hauteur, largeur] en cm */
  size: [number, number]
  image: string
  excerpt: string | null
  excerpt_duration: number | null
  frame: FrameId
  author_name: string
  author_contact: string
  copyright_office: string
  copyright_contact: string
  is_free: boolean
  recommended: boolean
  team_favorite: boolean
  status: ArtworkStatus
  publication_settled: boolean
  moderation_reason: string
  submitted_at: string | null
  published_at: string | null
  view_count: number
  created_at: string
  updated_at: string
}

export interface ArtworkInput {
  title?: string
  summary?: string
  technique?: string
  discipline?: Discipline
  height_cm?: string | number
  width_cm?: string | number
  image?: File
  /** Extrait audio ou vidéo de 30 s au plus (cahier des charges, p. 18) */
  excerpt?: File
  /** Durée de l'extrait, en secondes entières */
  excerpt_duration?: number
  frame?: FrameId
  author_name?: string
  author_contact?: string
  copyright_office?: string
  copyright_contact?: string
  is_free?: boolean
  owner_certified?: boolean
}

export interface SubmitResult {
  artwork: MyArtwork
  payment: PaymentSummary | null
  action: PaymentStarted['action'] | null
  free_publication: boolean
}

export interface MyGallery {
  address: number
  is_free: boolean
  free_until: string | null
  currently_free: boolean
  free_publication_used: boolean
}

export interface Quote {
  amount_ht: string
  vat: string
  amount_ttc: string
  currency: 'XOF' | 'EUR' | 'USD'
}

export interface Subscription {
  opened_at: string
  expires_at: string
  state: 'active' | 'soon' | 'standby'
  days_left: number
  renewal_quote: Quote
}

export interface WalletEntry {
  id: number
  date: string
  label: string
  /** Positif : recharge ; négatif : dépense (chaîne décimale) */
  amount: string
  balance_after: string
  payment: string | null
}

export interface Wallet {
  is_active: boolean
  balance: string
  currency: 'XOF' | 'EUR' | 'USD'
  history: Page<WalletEntry>
}

// --- Clés de cache -------------------------------------------------------------------------
export const artistKeys = {
  all: ['me'] as const,
  artworks: ['me', 'artworks'] as const,
  gallery: ['me', 'gallery'] as const,
  subscription: ['me', 'subscription'] as const,
  wallet: ['me', 'wallet'] as const,
  quote: (kind: string, region: string) => ['quote', kind, region] as const,
}

// --- Œuvres --------------------------------------------------------------------------------
export function useMyArtworks() {
  return useQuery({
    queryKey: artistKeys.artworks,
    queryFn: () => api<Page<MyArtwork>>('/catalog/me/artworks/', { query: { page_size: 100 } }),
  })
}

function artworkBody(input: ArtworkInput): FormData | ArtworkInput {
  return input.image || input.excerpt ? toFormData(input as Record<string, unknown>) : input
}

export function useCreateArtwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ArtworkInput) => api<MyArtwork>('/catalog/me/artworks/', { method: 'POST', body: toFormData(input as Record<string, unknown>) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: artistKeys.artworks }),
  })
}

export function useUpdateArtwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: ArtworkInput }) => api<MyArtwork>(`/catalog/me/artworks/${slug}/`, { method: 'PATCH', body: artworkBody(input) }),
    onSuccess: (work) => {
      qc.setQueryData<Page<MyArtwork>>(artistKeys.artworks, (page) => (page ? { ...page, results: page.results.map((w) => (w.slug === work.slug ? work : w)) } : page))
      void qc.invalidateQueries({ queryKey: ['me', 'dashboard'] })
    },
  })
}

export function useDeleteArtwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => api<void>(`/catalog/me/artworks/${slug}/`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: artistKeys.artworks })
      void qc.invalidateQueries({ queryKey: ['me', 'dashboard'] })
    },
  })
}

export function useSubmitArtwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, method }: { slug: string; method?: PaymentMethod }) =>
      api<SubmitResult>(`/catalog/me/artworks/${slug}/submit/`, { method: 'POST', body: method ? { method } : {} }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: artistKeys.artworks })
      void qc.invalidateQueries({ queryKey: artistKeys.gallery })
      void qc.invalidateQueries({ queryKey: artistKeys.wallet })
      void qc.invalidateQueries({ queryKey: ['me', 'dashboard'] })
    },
  })
}

/** Paiement à suivre après une soumission (null si aucune action de paiement) */
export function submitStarted(r: SubmitResult): PaymentStarted | null {
  return r.payment && r.action ? { payment: r.payment, action: r.action } : null
}

// --- Galerie -------------------------------------------------------------------------------
export function useMyGallery() {
  return useQuery({ queryKey: artistKeys.gallery, queryFn: () => api<MyGallery>('/catalog/me/gallery/') })
}

export function useUpdateGallery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: { is_free?: boolean; free_until?: string | null }) => api<MyGallery>('/catalog/me/gallery/', { method: 'PATCH', body: patch }),
    onSuccess: (g) => qc.setQueryData(artistKeys.gallery, g),
  })
}

// --- Tarifs --------------------------------------------------------------------------------
export function useQuote(kind: 'publication' | 'renewal', region: string | undefined) {
  return useQuery({
    queryKey: artistKeys.quote(kind, region ?? 'africa'),
    queryFn: () => api<Quote>('/payments/quote/', { query: { kind, region: region ?? 'africa' }, auth: false }),
    staleTime: 60 * 60_000,
  })
}

// --- Abonnement ----------------------------------------------------------------------------
export function useSubscription() {
  return useQuery({ queryKey: artistKeys.subscription, queryFn: () => api<Subscription>('/subscriptions/me/') })
}

export function useRenew() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (method: PaymentMethod) => api<PaymentStarted>('/subscriptions/me/renew/', { method: 'POST', body: { method } }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: artistKeys.subscription })
      void qc.invalidateQueries({ queryKey: artistKeys.wallet })
    },
  })
}

// --- Compte d'Avoir ------------------------------------------------------------------------
export function useWallet(page = 1) {
  return useQuery({
    queryKey: [...artistKeys.wallet, page],
    queryFn: () => api<Wallet>('/subscriptions/me/wallet/', { query: { page: page > 1 ? page : undefined } }),
    placeholderData: keepPreviousData,
  })
}

export function useSetWalletActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (is_active: boolean) => api<Wallet>('/subscriptions/me/wallet/', { method: 'PATCH', body: { is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: artistKeys.wallet }),
  })
}

export function useTopup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ amount, method }: { amount: number; method: 'card' | 'momo' }) =>
      api<PaymentStarted>('/subscriptions/me/wallet/topup/', { method: 'POST', body: { amount: String(amount), method } }),
    onSettled: () => qc.invalidateQueries({ queryKey: artistKeys.wallet }),
  })
}

// --- Retour d'un paiement ------------------------------------------------------------------
const RETURN_POLL_MS = 2_000
const RETURN_POLL_FOR_MS = 60_000

/**
 * Retour de la page de paiement (?payment=<référence>) : le statut affiché est celui renvoyé par
 * l'API (GET /payments/<réf>/), jamais le ?status= de l'URL. Un paiement en attente est
 * réinterrogé toutes les 2 s pendant 60 s ; les données de l'espace artiste sont rechargées
 * dès qu'il est terminé. Renvoie null s'il n'y a pas de retour de paiement.
 */
export function usePaymentReturn(): { reference: string; status: PaymentStatus | 'checking' } | null {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const reference = params.get('payment')
  const query = useQuery({
    queryKey: ['payment', reference],
    queryFn: () => getPayment(reference ?? ''),
    enabled: !!reference,
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === 'pending' && q.state.dataUpdateCount < RETURN_POLL_FOR_MS / RETURN_POLL_MS ? RETURN_POLL_MS : false),
  })
  const status = query.data?.status
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (!reference || !status || status === 'pending') return
    const key = `${reference}:${status}`
    if (done.current === key) return
    done.current = key
    void qc.invalidateQueries({ queryKey: artistKeys.all })
  }, [reference, status, qc])
  if (!reference) return null
  if (query.isError) return { reference, status: 'failed' }
  return { reference, status: status ?? 'checking' }
}
