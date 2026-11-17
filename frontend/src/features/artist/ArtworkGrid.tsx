import { Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Img } from '@/components/ui/Img'
import { formatSize } from '@/lib/format'
import { photos } from '@/mocks/photos'
import type { Artwork } from '@/types/catalog'

/** Mosaïque des œuvres, chacune dans un cadre blanc comme accrochée au mur. */
export function ArtworkGrid({ works, onOpen }: { works: Artwork[]; onOpen: (index: number) => void }) {
  const { t } = useTranslation()
  if (!works.length) return <p className="rounded-2xl bg-brand-mist p-8 text-center text-gray-500">{t('artist.noWorks')}</p>

  return (
    <ul className="columns-2 gap-5 md:columns-3 [&>li]:mb-5">
      {works.map((w, i) => (
        <li key={w.id} className="break-inside-avoid">
          <button type="button" onClick={() => onOpen(i)} className="group block w-full text-left">
            <span className="relative block bg-white p-2.5 shadow-[0_10px_30px_-14px_rgb(30_46_41/0.35)] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_22px_44px_-16px_rgb(30_46_41/0.45)] dark:bg-night-field">
              <span className="block overflow-hidden" style={{ aspectRatio: `${photos[w.photo].width} / ${photos[w.photo].height}` }}>
                <Img photo={w.photo} alt={w.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
              </span>
              <span className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-white/90 text-brand-graphite opacity-0 shadow transition group-hover:opacity-100">
                <Maximize2 className="size-4" />
              </span>
            </span>
            <span className="mt-3 block text-sm font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{w.title}</span>
            <span className="block text-xs text-gray-500">
              {w.technique} · {formatSize(w.size)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
