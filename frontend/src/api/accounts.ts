/**
 * Comptes et mot de passe (backend : apps/accounts). Voir backend/README.md, module 1.
 */
import { api, toFormData } from '@/lib/api'
import type { PaymentStarted } from '@/api/payments'
import type { SessionUser } from '@/stores/auth'

// --- Mot de passe oublié ----------------------------------------------------------------
export const forgotPassword = (body: { phone_country: string; phone: string }) =>
  api<{ detail?: string }>('/auth/password/forgot/', {
    method: 'POST',
    body,
    auth: false,
  })

export const verifyResetCode = (body: { phone_country: string; phone: string; code: string }) =>
  api<{ reset_token: string }>('/auth/password/verify/', {
    method: 'POST',
    body,
    auth: false,
  })

export const resetPassword = (body: { reset_token: string; password: string }) =>
  api<{ detail?: string }>('/auth/password/reset/', {
    method: 'POST',
    body,
    auth: false,
  })

export const changePassword = (body: { current_password: string; new_password: string }) => api<{ access: string }>('/auth/password/change/', { method: 'POST', body })

// --- Inscription ------------------------------------------------------------------------
export interface SignupResponse {
  /** Identifiant public de l'artiste (slug), à envoyer au paiement des frais d'ouverture */
  id: string
  login: string
  status: string
  region: 'africa' | 'europe' | 'world'
}

/** Inscription en multipart (champs en snake_case + photo) */
export const signup = (values: Record<string, unknown>) =>
  api<SignupResponse>('/accounts/signup/', {
    method: 'POST',
    body: toFormData(values),
    auth: false,
  })

export const startSignupPayment = (artist: string, method: 'momo' | 'card') =>
  api<PaymentStarted>('/payments/signup/', {
    method: 'POST',
    body: { artist, method },
    auth: false,
  })

// --- Compte connecté --------------------------------------------------------------------
export const getMe = () => api<SessionUser>('/accounts/me/')

/** Modification du profil : JSON, ou multipart si une photo est envoyée */
export const updateMe = (values: Record<string, unknown>) =>
  api<SessionUser>('/accounts/me/', {
    method: 'PATCH',
    body: Object.values(values).some((v) => v instanceof Blob) ? toFormData(values) : values,
  })

export interface PayoutInput {
  payout_momo: boolean
  momo_operator: string
  momo_number: string
  payout_iban: boolean
  iban: string
  account_holder: string
  bank_name: string
}

export const updatePayout = (values: Partial<PayoutInput>) => api<SessionUser>('/accounts/me/payout/', { method: 'PATCH', body: values })
