import { ChevronLeft, ChevronRight, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Img } from '@/components/ui/Img'
import { formatSize } from '@/lib/format'
import { ExcerptPlayer } from './ExcerptPlayer'
import type { CatalogArtwork } from '@/api/catalog'

interface Props {
  works: CatalogArtwork[]
  index: number
  artist: { name: string; city: string }
  onChange: (index: number) => void
  onClose: () => void
}

/** Œuvre en grand, sur fond clair : flèches du clavier pour naviguer, Échap pour fermer. */
export function ArtworkLightbox({ works, index, artist, onChange, onClose }: Props) {
  const { t } = useTranslation()
  const closeBtn = useRef<HTMLButtonElement>(null)
  const work = works[index]
  const go = (dir: 1 | -1) => onChange((index + dir + works.length) % works.length)

  useEffect(() => {
    closeBtn.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onChange((index + 1) % works.length)
      if (e.key === 'ArrowLeft') onChange((index - 1 + works.length) % works.length)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [index, works.length, onChange, onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={work.title} className="fixed inset-0 z-[60] flex flex-col bg-white/95 backdrop-blur-xl dark:bg-night-bg/95">
      <div className="flex items-center justify-between px-4 py-4 sm:px-8">
        <p className="text-sm text-gray-500">
          {index + 1} / {works.length}
        </p>
        <button ref={closeBtn} type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-brand-mist text-brand-graphite hover:bg-brand-green hover:text-white" aria-label={t('artist.close')}>
          <X className="size-5" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto px-4 pb-8 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="relative flex min-h-[50vh] items-center justify-center">
          <span className="block bg-white p-3 shadow-[0_30px_70px_-30px_rgb(30_46_41/0.5)]">
            <Img key={work.id} src={work.image} alt={work.title} className="max-h-[70vh] w-auto object-contain" />
          </span>
          {works.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} className="absolute left-0 grid size-12 place-items-center rounded-full bg-white text-brand-graphite shadow-lg hover:bg-brand-green hover:text-white" aria-label={t('common.previous')}>
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" onClick={() => go(1)} className="absolute right-0 grid size-12 place-items-center rounded-full bg-white text-brand-graphite shadow-lg hover:bg-brand-green hover:text-white" aria-label={t('common.next')}>
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
        </div>

        <aside className="self-center">
          <p className="eyebrow">{artist.name}</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-brand-graphite dark:text-white">{work.title}</h2>
          <dl className="mt-6 divide-y divide-brand-graphite/10 border-y border-brand-graphite/10 text-sm dark:divide-white/10 dark:border-white/10">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-gray-500">{t('artist.technique')}</dt>
              <dd className="text-right text-brand-graphite dark:text-white">{work.technique}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-gray-500">{t('artist.dimensions')}</dt>
              <dd className="text-brand-graphite dark:text-white">{formatSize(work.size)}</dd>
            </div>
          </dl>
          <p className="mt-6 text-sm leading-relaxed text-brand-ink dark:text-slate-300">{work.summary || t('catalog.artwork.summary', { title: work.title, name: artist.name, city: artist.city, technique: work.technique, h: work.size[0], w: work.size[1] })}</p>
          {work.excerpt && <ExcerptPlayer key={work.id} src={work.excerpt} title={work.title} className="mt-6" />}
          {work.copyright_office && (
            <p className="mt-6 flex items-start gap-2 rounded-xl bg-brand-mist p-4 text-xs text-gray-600 dark:bg-night-card dark:text-slate-300">
              <ShieldCheck className="size-4 shrink-0 text-brand-green" />
              {t('artist.protectedBy', { office: work.copyright_office })}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
