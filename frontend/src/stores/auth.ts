import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Session de l'artiste connecté. Simulation en attendant l'API :
 * la vraie vérification du numéro et du mot de passe se fera côté serveur (Django).
 * La session est gardée le temps de l'onglet (sessionStorage).
 */
interface AuthState {
  phone: string | null
  /** Artiste lié au compte (exemple : Awa Koné) */
  artistId: string | null
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      phone: null,
      artistId: null,
      login: async (phone) => {
        // TODO : appeler l'API d'authentification
        await new Promise((r) => setTimeout(r, 900))
        set({ phone, artistId: 'awa-kone' })
      },
      logout: () => set({ phone: null, artistId: null }),
    }),
    { name: 'agapy-session', storage: createJSONStorage(() => sessionStorage) },
  ),
)
