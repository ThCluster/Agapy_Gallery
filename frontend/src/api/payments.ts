/**
 * Paiements : contrat commun à toutes les pages qui font payer (ouverture, publication,
 * visite, don, clip, renouvellement, recharge). Backend : apps/payments.
 *
 * Après la création d'un paiement, le backend renvoie `{ payment, action }` :
 * - action.status === 'succeeded' : payé tout de suite (Compte d'Avoir) ;
 * - action.checkout_url : rediriger vers la page du prestataire. En développement, c'est
 *   /paiement/simulation?ref=… (page SimulationPage) qui confirme ou refuse le paiement.
 */
import { api } from '@/lib/api'

export type PaymentMethod = 'card' | 'momo' | 'wallet'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled'
export type PaymentPurpose = 'signup' | 'renewal' | 'publication' | 'visit' | 'donation' | 'clip' | 'wallet_topup'

export interface PaymentSummary {
  reference: string
  purpose?: PaymentPurpose
  method: PaymentMethod
  status: PaymentStatus
  amount_ht: string
  vat: string
  amount_ttc: string
  currency: 'XOF' | 'EUR' | 'USD'
}

export interface PaymentAction {
  status?: 'succeeded'
  checkout_url?: string
  simulate_url?: string
}

export interface PaymentStarted {
  payment: PaymentSummary
  action: PaymentAction
}

/** Statut public d'un paiement ; pour une visite payée, contient le jeton de visite */
export interface PaymentState extends PaymentSummary {
  paid_at?: string | null
  visit?: { token: string; expires_at: string } | null
  [key: string]: unknown
}

export const getPayment = (reference: string) => api<PaymentState>(`/payments/${reference}/`, { auth: false })

export const simulatePayment = (reference: string, status: 'succeeded' | 'failed') =>
  api<PaymentState>(`/payments/${reference}/simulate/`, { method: 'POST', body: { status }, auth: false })

/** Où revenir après le paiement (lu par la page de simulation / de retour) */
const RETURN_KEY = 'agapy-payment-return'

/**
 * Suit l'action renvoyée par le backend. `returnTo` : page où revenir une fois le paiement terminé
 * (la page de retour ajoute ?payment=<référence>&status=<statut>).
 * Renvoie true si le paiement est déjà confirmé (pas de redirection).
 */
export function followPaymentAction({ payment, action }: PaymentStarted, returnTo: string): boolean {
  if (action.status === 'succeeded' || payment.status === 'succeeded') return true
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ ref: payment.reference, returnTo }))
  } catch {
    // stockage indisponible : la page de simulation reviendra à l'accueil
  }
  if (action.checkout_url) {
    const url = new URL(action.checkout_url, window.location.origin)
    // En développement, la page de simulation est servie par le frontend lui-même
    window.location.assign(url.origin === window.location.origin ? url.pathname + url.search : url.toString())
  }
  return false
}

export function readPaymentReturn(reference: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? 'null') as { ref: string; returnTo: string } | null
    if (saved?.ref === reference) return saved.returnTo
  } catch {
    // ignore
  }
  return '/'
}

/** Jetons de visite payée, par artiste (gardés le temps de l'onglet) */
const VISIT_KEY = 'agapy-visit-tokens'

export function saveVisitToken(artistSlug: string, token: string, expiresAt: string) {
  try {
    const all = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? '{}') as Record<string, { token: string; expiresAt: string }>
    all[artistSlug] = { token, expiresAt }
    sessionStorage.setItem(VISIT_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

export function getVisitToken(artistSlug: string): string | null {
  try {
    const all = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? '{}') as Record<string, { token: string; expiresAt: string }>
    const entry = all[artistSlug]
    return entry && new Date(entry.expiresAt).getTime() > Date.now() ? entry.token : null
  } catch {
    return null
  }
}
