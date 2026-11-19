/** Publicité : clips de l'accueil, espaces publicitaires, TV en ligne. Backend : apps/promotions. */
import { useQuery } from '@tanstack/react-query'
import type { PaymentMethod, PaymentStarted } from '@/api/payments'
import { api, toFormData } from '@/lib/api'

/** Formats d'espace publicitaire côté API */
export type AdApiFormat = 'banner_468x60' | 'skyscraper_160x600' | 'button_88x31' | 'billboard_336x280' | 'site_skin'

export interface AdCampaign {
  id: number
  advertiser: string
  format: AdApiFormat
  image: string
  link_url: string
  alt_text: string
}

export interface LiveClip {
  id: number
  title: string
  advertiser: string
  video: string
  poster: string | null
  duration_seconds: number
  starts_at: string | null
  ends_at: string | null
}

export interface OrderedClip extends LiveClip {
  status: string
  paid_at: string | null
  queue_position: number | null
}

export interface LiveStream {
  id: number
  title: string
  description: string
  embed_url: string
  starts_at: string | null
  ends_at: string | null
  is_live: boolean
}

export interface ClipOrderInput {
  title: string
  advertiser: string
  contact_phone?: string
  contact_email?: string
  video: File
  poster?: File
  duration_seconds: number
  method: PaymentMethod
}

export type ClipOrderResponse = PaymentStarted & { clip: OrderedClip }

export function useAds(format: AdApiFormat) {
  return useQuery({
    queryKey: ['promotions', 'ads', format],
    queryFn: () => api<AdCampaign[]>('/promotions/ads/', { auth: false, query: { format } }),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useLiveClips() {
  return useQuery({
    queryKey: ['promotions', 'clips', 'live'],
    queryFn: () => api<LiveClip[]>('/promotions/clips/live/', { auth: false }),
    staleTime: 60_000,
    retry: false,
  })
}

export function useLiveTv() {
  return useQuery({
    queryKey: ['promotions', 'live-tv'],
    queryFn: () => api<{ live: LiveStream | null; upcoming: LiveStream[] }>('/promotions/live-tv/', { auth: false }),
    staleTime: 60_000,
    retry: false,
  })
}

export const orderClip = (input: ClipOrderInput) =>
  api<ClipOrderResponse>('/promotions/clips/', { method: 'POST', body: toFormData({ ...input }) })
