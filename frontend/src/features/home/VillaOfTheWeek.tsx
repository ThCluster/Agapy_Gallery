import { Gift, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { displayPrice, PRICES, useRegion } from '@/lib/pricing'
import { useArtists, useTrendingArtists } from '@/api/catalog'
import { hallPhotos, villaPhoto } from '@/features/artist/villaPhotos'

/** La villa de la semaine, avec le muret d'entrée décrit au cahier des charges. */
export function VillaOfTheWeek() {
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  // Pas de « villa de la semaine » dans l'API : l'artiste le plus visité, sinon le premier de la liste
  const trending = useTrendingArtists(1)
  const list = useArtists({ page_size: 1 })
  const artist = trending.data?.[0] ?? list.data?.results[0]
  if (!artist) return null
  const HALLS = hallPhotos(artist.address)

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow={t('home.villa.eyebrow')} title={t('home.villa.title')} subtitle={t('home.villa.subtitle')} />
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-mist lg:aspect-auto lg:h-full">
              <Img photo={villaPhoto(artist.address)} alt={t('home.villa.villaOf', { name: artist.name })} className="h-full w-full object-cover" />
              {/* Muret d'entrée : nom, adresse et une œuvre de l'artiste */}
              <div className="absolute bottom-5 left-5 flex max-w-[calc(100%-2.5rem)] items-center gap-4 rounded-xl bg-white/95 p-3 pr-5 shadow-xl backdrop-blur dark:bg-night-card/95">
                <span className="block h-16 w-14 shrink-0 overflow-hidden rounded-md">
                  <Img src={artist.cover} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold tracking-[0.18em] text-brand-orange uppercase">{t('home.villa.wall')}</span>
                  <span className="block truncate font-semibold text-brand-graphite dark:text-white">{artist.name}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="size-3" /> {t('home.villa.address', { n: artist.address })}
                  </span>
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal className="flex flex-col">
            <div className="flex items-center gap-4">
              <span className="block size-16 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-yellow ring-offset-2">
                <Img src={artist.photo ?? artist.cover} alt={artist.name} className="h-full w-full object-cover" />
              </span>
              <div>
                <p className="text-xl font-semibold text-brand-graphite dark:text-white">{artist.name}</p>
                <p className="text-sm text-gray-500">
                  {artist.discipline && `${t(`discipline.${artist.discipline}`)} · `}
                  {artist.city}, {artist.country}
                </p>
              </div>
            </div>
            <p className="mt-6 leading-relaxed text-brand-ink dark:text-slate-300">{t('home.villa.description')}</p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {HALLS.map((hall, i) => (
                <Link key={hall} to={`/artistes/${artist.id}`} className="group relative aspect-square overflow-hidden rounded-xl bg-brand-mist">
                  <Img photo={hall} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                  <span className="absolute bottom-2 left-2 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-brand-graphite">
                    {t('home.villa.hall', { n: i + 1 })}
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-auto flex flex-wrap gap-3 pt-8">
              <Link to={`/artistes/${artist.id}`} className="btn-primary px-6 py-3">
                {t('home.villa.visit', { price: artist.free ? t('artwork.free') : displayPrice(PRICES.visit, region, i18n.resolvedLanguage) })}
              </Link>
              <Link to={`/artistes/${artist.id}?don=1`} className="btn-secondary px-6 py-3">
                <Gift className="size-4" /> {t('home.villa.donate')}
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
