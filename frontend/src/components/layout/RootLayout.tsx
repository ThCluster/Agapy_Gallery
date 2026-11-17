import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { PageSkin } from '@/components/ui/AdSlot'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function RootLayout() {
  const { pathname } = useLocation()

  // Revient en haut de page à chaque changement de page.
  // Accolades obligatoires : scrollTo() renvoie une promesse dans les Chrome récents,
  // et React la prendrait pour une fonction de nettoyage (« destroy is not a function »).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {/* Habillage publicitaire (skyscrapers 160 × 600) sur les très grands écrans */}
      <PageSkin />
      {/* L'en-tête est fixe : on laisse sa hauteur, sauf sur l'accueil où la photo passe dessous */}
      <main className={`flex-1 ${pathname === '/' ? '' : 'pt-20'}`}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
