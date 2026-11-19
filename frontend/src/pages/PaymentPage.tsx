import { Navigate, useSearchParams } from 'react-router'

/**
 * Ancienne adresse /paiement?artiste=<slug>&visite=1&don=… : la visite et le don se font
 * maintenant depuis la fiche de l'artiste (carte « Soutenir »), branchée sur l'API.
 * Les paiements eux-mêmes passent par /paiement/simulation (développement) ou le prestataire.
 */
export function PaymentPage() {
  const [params] = useSearchParams()
  const artist = params.get('artiste')
  return <Navigate to={artist ? `/artistes/${encodeURIComponent(artist)}#support` : '/artistes'} replace />
}
