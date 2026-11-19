/**
 * Tableau de bord de l'artiste (apps/dashboards) et revenus / retraits (apps/payments).
 * Les endpoints du tableau de bord peuvent ne pas exister encore : un 404 donne `null`.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Page } from '@/lib/api'
import type { Period } from '@/features/dashboard/revenue'

export type Currency = 'XOF' | 'EUR' | 'USD'

export interface DashboardSummary {
  currency: Currency
  available_balance: string
  total_earned: string
  provision_held: string
  visits: { total: number; paid: number; free: number; last_30_days: number }
  donations: { count: number; total: string }
  artworks: { published: number; pending_review: number; rejected: number; draft: number; total_views: number }
  top_artworks: { id: string; title: string; view_count: number }[]
}

export interface RevenuePoint {
  start: string
  visits: string
  donations: string
  total: string
  visit_count: number
}

export interface Revenue {
  currency: Currency
  currencies: Currency[]
  period: Period
  from: string
  to: string
  series: RevenuePoint[]
  totals: { visits: string; donations: string; total: string; visit_count: number }
}

export interface Balance {
  currency: Currency
  available: string
  pending_payouts: string
  paid_out: string
  total_earned: string
  provision: string
}

export type PayoutChannel = 'momo' | 'iban'

export interface Payout {
  id: number
  amount: string
  currency: Currency
  channel: PayoutChannel
  destination: string
  status: 'pending' | 'paid' | 'rejected'
  note: string
  created_at: string
  processed_at: string | null
}

/** null si l'endpoint n'existe pas (encore) */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['me', 'dashboard', 'summary'],
    queryFn: () => orNull(api<DashboardSummary>('/dashboards/me/summary/')),
  })
}

export interface RevenueParams {
  period: Period
  from?: string
  to?: string
  currency?: string
}

export function useRevenue(params: RevenueParams) {
  return useQuery({
    queryKey: ['me', 'dashboard', 'revenue', params],
    queryFn: () => orNull(api<Revenue>('/dashboards/me/revenue/', { query: { ...params } })),
    placeholderData: keepPreviousData,
  })
}

export function useBalances() {
  return useQuery({ queryKey: ['me', 'balance'], queryFn: () => api<Balance[]>('/payments/me/balance/') })
}

export function usePayouts() {
  return useQuery({ queryKey: ['me', 'payouts'], queryFn: () => api<Page<Payout>>('/payments/me/payouts/') })
}

export function useRequestPayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { amount: string; currency: Currency; channel: PayoutChannel }) => api<Payout>('/payments/me/payouts/', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me', 'payouts'] })
      void qc.invalidateQueries({ queryKey: ['me', 'balance'] })
      void qc.invalidateQueries({ queryKey: ['me', 'dashboard'] })
    },
  })
}
