import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { formatSize } from '@/lib/format'
import { displayPrice, PRICES, useRegion } from '@/lib/pricing'
import { artistById } from '@/mocks/homeData'
import { photos } from '@/mocks/photos'
import type { Artwork } from '@/types/catalog'

export function ArtworkCard({ artwork, free = false }: { artwork: Artwork; free?: boolean }) {
  const { t, i18n } = useTranslation()
  const region = useRegion((s) => s.region)
  const artist = artistById(artwork.artistId)
  const photo = photos[artwork.photo]
  const tall = photo.height > photo.width

  return (
    <article className="group relative w-[200px] shrink-0 snap-start sm:w-[230px]">
      {/* Images alignées en bas, chacune garde ses proportions, comme accrochées au mur */}
      <div className="relative flex h-[250px] items-end justify-center sm:h-[290px]">
        <Link
          to={`/oeuvres/${artwork.id}`}
          className={`relative block overflow-hidden bg-brand-mist shadow-[0_10px_30px_-12px_rgb(30_46_41/0.35)] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_22px_40px_-14px_rgb(30_46_41/0.45)] ${tall ? 'h-full' : 'w-full'}`}
          style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        >
          <Img photo={artwork.photo} alt={`${artwork.title}, ${artist?.name ?? ''}`} className="h-full w-full object-cover" />
          {free && (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand-green shadow-sm">
              {t('artwork.free')}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-4 text-sm">
        <Link to={`/oeuvres/${artwork.id}`} className="block truncate font-semibold text-brand-graphite hover:text-brand-green dark:text-white">
          {artwork.title}
        </Link>
        {artist && (
          <Link to={`/artistes/${artist.id}`} className="mt-0.5 block truncate text-brand-ink/80 hover:underline dark:text-slate-300">
            {artist.name}
          </Link>
        )}
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {artwork.technique} · {formatSize(artwork.size)}
        </p>
        <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-brand-graphite/10 pt-2">
          <span className="text-xs text-gray-500">{t('artwork.visit')}</span>
          <span className="price">{free ? t('artwork.free') : displayPrice(PRICES.visit, region, i18n.resolvedLanguage)}</span>
        </p>
      </div>
    </article>
  )
}
