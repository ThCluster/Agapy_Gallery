import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Img } from '@/components/ui/Img'
import type { Artist, Artwork } from '@/types/catalog'

/** Le muret d'entrée de la villa : nom, adresse et une œuvre de l'artiste (cahier des charges, p. 3). */
export function EntranceWall({ artist, work, onOpen }: { artist: Artist; work?: Artwork; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f3efe7] to-[#e9e3d8] p-6 sm:p-8 dark:from-night-card dark:to-night-field">
      {/* Fines lignes de pierre */}
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:repeating-linear-gradient(0deg,transparent_0_46px,rgb(30_46_41/0.06)_46px_47px)]" />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row">
        {work && (
          <button type="button" onClick={onOpen} className="group shrink-0 bg-white p-2.5 shadow-[0_12px_30px_-12px_rgb(30_46_41/0.4)]" aria-label={work.title}>
            <span className="block h-36 w-28 overflow-hidden sm:h-44 sm:w-36">
              <Img photo={work.photo} alt={work.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            </span>
          </button>
        )}
        <div className="text-center sm:text-left">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-orange uppercase">{t('artist.wall.title')}</p>
          <p className="mt-2 font-logo text-3xl font-extrabold text-brand-graphite dark:text-white">{artist.name}</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-gray-500 sm:justify-start">
            <MapPin className="size-4" /> {t('artist.address', { n: artist.address })}
          </p>
          <p className="mt-3 max-w-md text-sm text-brand-ink/80 dark:text-slate-300">{t('artist.wall.text')}</p>
        </div>
      </div>
    </div>
  )
}
