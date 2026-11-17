import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PhotoKey } from '@/mocks/photos'

/**
 * Données de l'espace artiste (simulation en attendant l'API Django) :
 * abonnement annuel, Compte d'Avoir, œuvres publiées et statut de la galerie.
 */

export type WorkStatus = 'published' | 'pending' | 'rejected'

export interface MyWork {
  id: string
  title: string
  technique: string
  size: [number, number]
  photo?: PhotoKey
  /** Aperçu d'une image importée (adresse locale temporaire) */
  previewUrl?: string
  frame: FrameId
  status: WorkStatus
  free: boolean
  createdAt: string
}

export type FrameId = 'black' | 'wood' | 'gold' | 'white' | 'none'
export const FRAMES: FrameId[] = ['black', 'wood', 'gold', 'white', 'none']

export interface WalletEntry {
  id: string
  date: string
  label: string
  /** Positif : recharge ; négatif : dépense */
  amount: number
}

const DAY = 86_400_000
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const today = () => new Date()

interface ArtistSpaceState {
  openedAt: string
  /** Fin de la période d'abonnement en cours : au-delà, le compte est mis en veille */
  expiresAt: string
  freePublicationUsed: boolean
  wallet: { active: boolean; balance: number; history: WalletEntry[] }
  galleryFree: boolean
  galleryFreeUntil: string
  works: MyWork[]
  renew: () => void
  setWalletActive: (active: boolean) => void
  topUp: (amount: number, label: string) => void
  spend: (amount: number, label: string) => boolean
  addWork: (work: Omit<MyWork, 'id' | 'status' | 'createdAt'>) => void
  updateWork: (id: string, patch: Partial<MyWork>) => void
  removeWork: (id: string) => void
  setGallery: (free: boolean, until: string) => void
}

const now = today()

export const useArtistSpace = create<ArtistSpaceState>()(
  persist(
    (set, get) => ({
      openedAt: isoDate(new Date(now.getTime() - 353 * DAY)),
      // Exemple : l'abonnement arrive à échéance dans 12 jours
      expiresAt: isoDate(new Date(now.getTime() + 12 * DAY)),
      freePublicationUsed: true,
      wallet: {
        active: false,
        balance: 7_500,
        history: [
          { id: 'w1', date: isoDate(new Date(now.getTime() - 40 * DAY)), label: 'Recharge mobile money', amount: 10_000 },
          { id: 'w2', date: isoDate(new Date(now.getTime() - 32 * DAY)), label: 'Publication « Saison des pluies »', amount: -2_500 },
        ],
      },
      galleryFree: false,
      galleryFreeUntil: '',
      works: [
        { id: 'lumiere-lagune', title: 'Lumière de la lagune', technique: 'Acrylique sur toile', size: [120, 90], photo: 'art_a1', frame: 'black', status: 'published', free: false, createdAt: isoDate(new Date(now.getTime() - 300 * DAY)) },
        { id: 'harmattan', title: 'Harmattan', technique: 'Acrylique sur toile', size: [65, 100], photo: 'art_a3', frame: 'wood', status: 'published', free: false, createdAt: isoDate(new Date(now.getTime() - 120 * DAY)) },
        { id: 'saison-pluies', title: 'Saison des pluies', technique: 'Acrylique sur toile', size: [100, 75], photo: 'art_a5', frame: 'white', status: 'published', free: true, createdAt: isoDate(new Date(now.getTime() - 32 * DAY)) },
        { id: 'jardin-nuit', title: 'Jardin de nuit', technique: 'Huile sur toile', size: [80, 60], photo: 'art_a7', frame: 'gold', status: 'pending', free: false, createdAt: isoDate(new Date(now.getTime() - 2 * DAY)) },
      ],
      renew: () => {
        // Renouvellement d'un an à partir de l'échéance (ou d'aujourd'hui si le compte est déjà en veille)
        const base = Math.max(new Date(get().expiresAt).getTime(), today().getTime())
        const next = new Date(base)
        next.setFullYear(next.getFullYear() + 1)
        set({ expiresAt: isoDate(next) })
      },
      setWalletActive: (active) => set((s) => ({ wallet: { ...s.wallet, active } })),
      topUp: (amount, label) =>
        set((s) => ({
          wallet: {
            ...s.wallet,
            balance: s.wallet.balance + amount,
            history: [{ id: crypto.randomUUID(), date: isoDate(today()), label, amount }, ...s.wallet.history],
          },
        })),
      spend: (amount, label) => {
        const { wallet } = get()
        if (!wallet.active || wallet.balance < amount) return false
        set({
          wallet: {
            ...wallet,
            balance: wallet.balance - amount,
            history: [{ id: crypto.randomUUID(), date: isoDate(today()), label, amount: -amount }, ...wallet.history],
          },
        })
        return true
      },
      addWork: (work) =>
        set((s) => ({
          freePublicationUsed: true,
          works: [{ ...work, id: crypto.randomUUID(), status: 'pending', createdAt: isoDate(today()) }, ...s.works],
        })),
      updateWork: (id, patch) => set((s) => ({ works: s.works.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      removeWork: (id) => set((s) => ({ works: s.works.filter((w) => w.id !== id) })),
      setGallery: (galleryFree, galleryFreeUntil) => set({ galleryFree, galleryFreeUntil }),
    }),
    {
      name: 'agapy-artist-space',
      storage: createJSONStorage(() => sessionStorage),
      // Les aperçus d'images importées ne survivent pas à un rechargement
      partialize: ({ works, ...rest }) => ({ ...rest, works: works.map(({ previewUrl: _p, ...w }) => w) }),
    },
  ),
)

/** État de l'abonnement annuel (cahier des charges, p. 8) */
export function subscriptionState(expiresAt: string): { state: 'active' | 'soon' | 'standby'; daysLeft: number } {
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY)
  return { state: daysLeft < 0 ? 'standby' : daysLeft <= 30 ? 'soon' : 'active', daysLeft }
}
