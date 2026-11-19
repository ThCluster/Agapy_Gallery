/**
 * Paiements : contrat commun à toutes les pages qui font payer (ouverture, publication,
 * visite, don, clip, renouvellement, recharge). Backend : apps/payments.
 *
 * Après la création d'un paiement, le backend renvoie `{ payment, action }` :
 * - action.status === 'succeeded' : payé tout de suite (Compte d'Avoir) ;
 * - action.checkout_url : adresse RELATIVE de la page de paiement, aujourd'hui
 *   /paiement/simulation?ref=… (PaymentSimulationPage) qui confirme ou refuse le paiement.
 *   Une URL absolue n'est suivie que si elle est de même origine (pas encore de prestataire externe).
 */
import { api } from '@/lib/api'
import { safeInternalPath } from '@/lib/safePath'

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
  if (!action.checkout_url) return false
  // Seule une page du site est acceptée (chemin relatif, ou URL absolue de même origine)
  const checkout = safeInternalPath(action.checkout_url, '')
  if (!checkout) throw new Error(`Adresse de paiement refusée : ${action.checkout_url}`)
  try {
    // Chemin seul (sans origine) : le retour marche que le site soit ouvert sur localhost ou 127.0.0.1
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ ref: payment.reference, returnTo: safeInternalPath(returnTo) }))
  } catch {
    // stockage indisponible : la page de simulation reviendra à l'accueil
  }
  window.location.assign(checkout)
  return false
}

/** Page où revenir après le paiement `reference` : toujours un chemin interne (repli : accueil) */
export function readPaymentReturn(reference: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? 'null') as { ref?: unknown; returnTo?: unknown } | null
    if (saved?.ref === reference && typeof saved.returnTo === 'string') return safeInternalPath(saved.returnTo)
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
