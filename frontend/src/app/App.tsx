import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { queryClient } from '@/lib/queryClient'
import { useAuth } from '@/stores/auth'
import { router } from './router'

// Au chargement : retrouver la session grâce au cookie de rafraîchissement
void useAuth.getState().init()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
