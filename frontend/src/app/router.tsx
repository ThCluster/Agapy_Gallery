import type React from 'react'
import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { ArtistPage } from '@/pages/ArtistPage'
import { ArtworkPage } from '@/pages/ArtworkPage'
import { ArtistsPage } from '@/pages/ArtistsPage'
import { DisciplinePage } from '@/pages/DisciplinePage'
import { ErrorPage } from '@/pages/ErrorPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { FreeGalleriesPage } from '@/pages/FreeGalleriesPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SearchPage } from '@/pages/SearchPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const WorldPage = lazy(() => import('@/world3d/WorldPage'))

/** Page chargée à la demande (allège le premier chargement du site) */
const load = (importer: () => Promise<Record<string, unknown>>, name: string) => async () => ({ Component: (await importer())[name] as React.ComponentType })

export const router = createBrowserRouter([
  // Connexion des exposants : page plein écran, sans barre de navigation
  { path: '/connexion', element: <LoginPage />, errorElement: <ErrorPage /> },
  { path: '/mot-de-passe-oublie', element: <ForgotPasswordPage />, errorElement: <ErrorPage /> },
  // Espace artiste : réservé aux artistes connectés, avec sa propre mise en page
  // (l'administration AGAPY est gérée côté Django)
  {
    path: '/tableau-de-bord',
    lazy: load(() => import('@/features/dashboard/DashboardLayout'), 'DashboardLayout'),
    errorElement: <ErrorPage />,
    children: [
      { index: true, lazy: load(() => import('@/features/dashboard/pages/OverviewPage'), 'OverviewPage') },
      { path: 'oeuvres', lazy: load(() => import('@/features/dashboard/pages/MyWorksPage'), 'MyWorksPage') },
      { path: 'publier', lazy: load(() => import('@/features/dashboard/pages/PublishPage'), 'PublishPage') },
      { path: 'compte-avoir', lazy: load(() => import('@/features/dashboard/pages/WalletPage'), 'WalletPage') },
      { path: 'abonnement', lazy: load(() => import('@/features/dashboard/pages/SubscriptionPage'), 'SubscriptionPage') },
      { path: 'profil', lazy: load(() => import('@/features/dashboard/pages/ProfilePage'), 'ProfilePage') },
    ],
  },
  {
    path: '/',
    element: <RootLayout />,
    // Erreur dans l'en-tête ou le pied de page : page d'erreur seule
    errorElement: <ErrorPage />,
    children: [
      {
        // Erreur dans une page : l'en-tête et le pied de page restent affichés
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'inscription', lazy: load(() => import('@/pages/SignupPage'), 'SignupPage') },
          { path: 'recherche', element: <SearchPage /> },
          { path: 'paiement', lazy: load(() => import('@/pages/PaymentPage'), 'PaymentPage') },
          { path: 'artistes', element: <ArtistsPage /> },
          { path: 'galeries-gratuites', element: <FreeGalleriesPage /> },
          { path: 'peinture', element: <DisciplinePage key="peinture" discipline="peinture" /> },
          { path: 'photographie', element: <DisciplinePage key="photographie" discipline="photographie" /> },
          { path: 'sculpture', element: <DisciplinePage key="sculpture" discipline="sculpture" /> },
          { path: 'artistes/:artistId', element: <ArtistPage /> },
          { path: 'oeuvres/:artworkId', element: <ArtworkPage /> },
          {
            path: 'ville',
            element: (
              <Suspense fallback={<p className="p-8 text-center">Chargement de la ville…</p>}>
                <WorldPage />
              </Suspense>
            ),
          },
          // Pages fixes
          { path: 'qui-sommes-nous', lazy: load(() => import('@/pages/static/AboutPage'), 'AboutPage') },
          { path: 'conditions-generales', lazy: load(() => import('@/pages/static/TermsPage'), 'TermsPage') },
          { path: 'infos-legales', lazy: load(() => import('@/pages/static/LegalPage'), 'LegalPage') },
          { path: 'partenaires', lazy: load(() => import('@/pages/static/PartnersPage'), 'PartnersPage') },
          { path: 'contact', lazy: load(() => import('@/pages/static/ContactPage'), 'ContactPage') },
          { path: 'forum', lazy: load(() => import('@/pages/static/ForumPage'), 'ForumPage') },
          { path: 'publicite', lazy: load(() => import('@/pages/static/AdvertisingPage'), 'AdvertisingPage') },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
