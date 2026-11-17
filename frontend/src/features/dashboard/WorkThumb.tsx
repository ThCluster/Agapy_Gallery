import { ImageIcon } from 'lucide-react'
import { Img } from '@/components/ui/Img'
import type { MyWork } from '@/stores/artistSpace'
import { FRAME_CLASS } from './frames'

/** Vignette d'une œuvre de l'artiste, dans son cadre virtuel. */
export function WorkThumb({ work, className = 'h-28 w-24' }: { work: Pick<MyWork, 'photo' | 'previewUrl' | 'title' | 'frame'>; className?: string }) {
  const frame = FRAME_CLASS[work.frame].replace(/p-\d/, 'p-1.5').replace(/border-\[\d+px\]/, 'border-[4px]')
  return (
    <span className={`block shrink-0 shadow-[0_10px_24px_-14px_rgb(30_46_41/0.5)] ${frame}`}>
      <span className={`grid place-items-center overflow-hidden bg-brand-mist ${className}`}>
        {work.previewUrl ? (
          <img src={work.previewUrl} alt={work.title} className="h-full w-full object-cover" />
        ) : work.photo ? (
          <Img photo={work.photo} alt={work.title} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-gray-400" />
        )}
      </span>
    </span>
  )
}
