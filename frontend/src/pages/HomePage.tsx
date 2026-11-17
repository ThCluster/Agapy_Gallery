import { useTranslation } from 'react-i18next'
import { ArtworkCard } from '@/components/ui/ArtworkCard'
import { CarouselSection } from '@/components/ui/CarouselSection'
import { AdvertisersSection } from '@/features/home/AdvertisersSection'
import { ClipsSection } from '@/features/home/ClipsSection'
import { ExhibitSection } from '@/features/home/ExhibitSection'
import { HeroSection } from '@/features/home/HeroSection'
import { HowItWorks } from '@/features/home/HowItWorks'
import { InterviewsBand } from '@/features/home/InterviewsBand'
import { Reassurance } from '@/features/home/Reassurance'
import { TrendingArtists } from '@/features/home/TrendingArtists'
import { VillaOfTheWeek } from '@/features/home/VillaOfTheWeek'
import { VisitOptions } from '@/features/home/VisitOptions'
import { freeGalleries, recommended, teamFavorites } from '@/mocks/homeData'

export function HomePage() {
  const { t } = useTranslation()

  return (
    <>
      <HeroSection />

      <CarouselSection
        eyebrow={t('home.recommended.eyebrow')}
        title={t('home.recommended.title')}
        subtitle={t('home.recommended.subtitle')}
        cta={{ label: t('home.recommended.cta'), to: '/recherche?mode=artwork' }}
      >
        {recommended.map((a) => (
          <ArtworkCard key={a.id} artwork={a} />
        ))}
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
        {freeGalleries.map((a) => (
          <ArtworkCard key={a.id} artwork={a} free />
        ))}
      </CarouselSection>

      <InterviewsBand />

      <CarouselSection
        eyebrow={t('home.favorites.eyebrow')}
        title={t('home.favorites.title')}
        subtitle={t('home.favorites.subtitle')}
        cta={{ label: t('home.recommended.cta'), to: '/recherche?mode=artwork' }}
      >
        {teamFavorites.map((a) => (
          <ArtworkCard key={a.id} artwork={a} />
        ))}
      </CarouselSection>

      <AdvertisersSection />
      <ExhibitSection />
      <Reassurance />
    </>
  )
}
