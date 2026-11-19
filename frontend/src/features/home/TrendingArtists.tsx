import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { useTrendingArtists } from '@/api/catalog'

// Mosaïque : une grande case, deux moyennes, puis trois petites
const LAYOUT = [
  'col-span-2 row-span-2 md:col-span-3',
  'md:col-span-3',
  'md:col-span-3',
  'md:col-span-2',
  'md:col-span-2',
  'col-span-2 md:col-span-2',
]

export function TrendingArtists() {
  const { t } = useTranslation()
  const { data: artists, isPending } = useTrendingArtists(6)
  if (!isPending && !artists?.length) return null
  return (
    <section className="pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow={t('home.trending.eyebrow')}
            title={t('home.trending.title')}
            subtitle={t('home.trending.subtitle')}
            actions={
              <Link to="/artistes" className="link text-sm font-semibold">
                {t('home.trending.cta')} →
              </Link>
            }
          />
        </Reveal>
        <div className="grid auto-rows-[180px] grid-cols-2 gap-4 md:auto-rows-[230px] md:grid-cols-6">
          {isPending &&
            LAYOUT.map((cls, i) => <div key={i} className={`${cls} animate-pulse rounded-2xl bg-brand-mist dark:bg-night-card`} aria-hidden />)}
          {artists?.map((artist, i) => (
            <Reveal key={artist.id} className={LAYOUT[i]}>
              <Link to={`/artistes/${artist.id}`} className="group relative block h-full overflow-hidden rounded-2xl bg-brand-mist">
                <Img src={artist.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                  <div>
                    <p className={`font-semibold text-white ${i === 0 ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{artist.name}</p>
                    <p className="mt-0.5 text-xs text-white/75">
                      {artist.discipline && `${t(`discipline.${artist.discipline}`)} · `}
                      {artist.city}, {artist.country}
                    </p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/90 text-brand-graphite transition group-hover:bg-brand-yellow">
                    <ArrowUpRight className="size-5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
