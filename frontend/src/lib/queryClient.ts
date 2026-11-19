import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'

/**
 * Cache partagé de react-query. Vidé à la connexion, à la déconnexion et à la perte de session
 * (stores/auth.ts) : les données d'un compte ne doivent jamais apparaître pour un autre.
 * Les erreurs client (4xx) ne sont pas retentées.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 1,
    },
  },
})
