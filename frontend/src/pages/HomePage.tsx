import { useTranslation } from 'react-i18next'
import type { CatalogArtwork } from '@/api/catalog'
import { useArtworks, useFreeGalleryWorks } from '@/api/catalog'
import { ArtworkCard, ArtworkCardSkeleton } from '@/components/ui/ArtworkCard'
import { CarouselSection } from '@/components/ui/CarouselSection'
import { AdvertisersSection } from '@/features/home/AdvertisersSection'
import { ClipsSection } from '@/features/home/ClipsSection'
import { ExhibitSection } from '@/features/home/ExhibitSection'
import { HeroSection } from '@/features/home/HeroSection'
import { HowItWorks } from '@/features/home/HowItWorks'
import { Reassurance } from '@/features/home/Reassurance'
import { TrendingArtists } from '@/features/home/TrendingArtists'
import { VillaOfTheWeek } from '@/features/home/VillaOfTheWeek'
import { VisitOptions } from '@/features/home/VisitOptions'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/** Contenu d'un carrousel d'œuvres : squelettes, message vide ou cartes */
function Works({ works, pending, free = false }: { works?: CatalogArtwork[]; pending: boolean; free?: boolean }) {
  const { t } = useTranslation()
  if (pending) return Array.from({ length: 5 }, (_, i) => <ArtworkCardSkeleton key={i} />)
  if (!works?.length) return <p className="py-10 text-sm text-gray-500">{t('catalog.empty')}</p>
  return works.map((a) => <ArtworkCard key={a.id} artwork={a} free={free} />)
}

export function HomePage() {
  const { t } = useTranslation()
  const recommended = useArtworks({ recommended: true, page_size: 12 })
  const favorites = useArtworks({ team_favorite: true, page_size: 12 })
  const free = useFreeGalleryWorks(12)
  useDocumentTitle(null)

  return (
    <>
      <HeroSection />

      <CarouselSection
        eyebrow={t('home.recommended.eyebrow')}
        title={t('home.recommended.title')}
        subtitle={t('home.recommended.subtitle')}
        cta={{ label: t('home.recommended.cta'), to: '/recherche?mode=artwork' }}
      >
        <Works works={recommended.data?.results} pending={recommended.isPending} />
      </CarouselSection>

      <TrendingArtists />
      <ClipsSection />
      <HowItWorks />
      <VisitOptions />
      <VillaOfTheWeek />

      <CarouselSection
        tone="mist"
        eyebrow={t('home.free.eyebrow')}
        title={t('home.free.title')}
        subtitle={t('home.free.subtitle')}
        cta={{ label: t('home.free.cta'), to: '/galeries-gratuites' }}
      >
        <Works works={free.data} pending={free.isPending} free />
      </CarouselSection>

      {/* Interviews d'artistes : masquées tant qu'aucune interview réelle n'est publiée */}

      <CarouselSection
        eyebrow={t('home.favorites.eyebrow')}
        title={t('home.favorites.title')}
        subtitle={t('home.favorites.subtitle')}
        cta={{ label: t('home.recommended.cta'), to: '/recherche?mode=artwork' }}
      >
        <Works works={favorites.data?.results} pending={favorites.isPending} />
      </CarouselSection>

      <AdvertisersSection />
      <ExhibitSection />
      <Reassurance />
    </>
  )
}
