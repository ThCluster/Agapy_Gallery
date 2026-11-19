import { create } from 'zustand'
import { api, setTokenBridge } from '@/lib/api'

/**
 * Session de l'artiste connecté, branchée sur /api/v1/auth/.
 * Le jeton d'accès est gardé en mémoire uniquement ; au chargement, `init()` le récupère
 * grâce au cookie de rafraîchissement (HttpOnly). Voir backend/README.md.
 */

/** Compte connecté, tel que renvoyé par /auth/login/ et /accounts/me/ */
export interface SessionUser {
  id: number
  phone: string
  email: string
  artist: {
    /** Identifiant public (slug), ex. « awa-kone » */
    id: string
    status: 'pending_payment' | 'active' | 'dormant' | 'excluded'
    display_name: string
    region: 'africa' | 'europe' | 'world'
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

type Status = 'unknown' | 'anonymous' | 'authenticated'

interface AuthState {
  status: Status
  access: string | null
  user: SessionUser | null
  /** Identifiant public de l'artiste connecté (compatibilité avec les pages existantes) */
  artistId: string | null
  phone: string | null
  init: () => Promise<void>
  login: (input: { phone_country: string; phone: string; password: string; remember: boolean }) => Promise<SessionUser>
  logout: () => Promise<void>
  setAccess: (access: string) => void
  setUser: (user: SessionUser) => void
  refresh: () => Promise<boolean>
}

let refreshing: Promise<boolean> | null = null
let initializing: Promise<void> | null = null

const fromUser = (user: SessionUser | null) => ({ user, artistId: user?.artist?.id ?? null, phone: user?.phone ?? null })

export const useAuth = create<AuthState>()((set, get) => ({
  status: 'unknown',
  access: null,
  user: null,
  artistId: null,
  phone: null,

  setAccess: (access) => set({ access }),
  setUser: (user) => set(fromUser(user)),

  /** Un seul rafraîchissement à la fois : le cookie est à usage unique */
  refresh: () => {
    refreshing ??= api<{ access: string }>('/auth/refresh/', { method: 'POST', auth: false })
      .then(({ access }) => {
        set({ access })
        return true
      })
      .catch(() => {
        set({ access: null, status: 'anonymous', ...fromUser(null) })
        return false
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  },

  init: () => {
    initializing ??= (async () => {
      if (await get().refresh()) {
        try {
          const user = await api<SessionUser>('/accounts/me/')
          set({ status: 'authenticated', ...fromUser(user) })
        } catch {
          set({ status: 'anonymous', access: null, ...fromUser(null) })
        }
      }
    })()
    return initializing
  },

  login: async (input) => {
    const { access, user } = await api<{ access: string; user: SessionUser }>('/auth/login/', { method: 'POST', body: input, auth: false })
    set({ access, status: 'authenticated', ...fromUser(user) })
    return user
  },

  logout: async () => {
    try {
      await api('/auth/logout/', { method: 'POST', auth: false })
    } finally {
      set({ access: null, status: 'anonymous', ...fromUser(null) })
    }
  },
}))

setTokenBridge({ get: () => useAuth.getState().access, refresh: () => useAuth.getState().refresh() })
