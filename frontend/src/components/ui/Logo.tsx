/**
 * Logo officiel AGAPY-GALLERY : A en arche (porte d'entrée), p en carte de l'Afrique,
 * G au soleil. Version couleur sur fond clair, version blanche à touches jaunes
 * sur fond vert ou sur photo (charte AGAPY).
 */
export function Logo({ variant = 'color', className = 'h-9' }: { variant?: 'color' | 'white'; className?: string }) {
  return (
    <img
      src={variant === 'white' ? '/brand/logo-white.svg' : '/brand/logo.svg'}
      alt="Agapy Gallery"
      width={7224}
      height={1175}
      className={`w-auto ${className}`}
      draggable={false}
    />
  )
}
