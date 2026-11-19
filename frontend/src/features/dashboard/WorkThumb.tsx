import { ImageIcon } from 'lucide-react'
import type { FrameId } from './frames'
import { FRAME_CLASS } from './frames'

/** Vignette d'une œuvre de l'artiste, dans son cadre virtuel (image servie par l'API ou aperçu local). */
export function WorkThumb({ work, className = 'h-28 w-24' }: { work: { image?: string | null; previewUrl?: string; title: string; frame: FrameId }; className?: string }) {
  const frame = (FRAME_CLASS[work.frame] ?? FRAME_CLASS.none).replace(/p-\d/, 'p-1.5').replace(/border-\[\d+px\]/, 'border-[4px]')
  const src = work.previewUrl ?? work.image
  return (
    <span className={`block shrink-0 shadow-[0_10px_24px_-14px_rgb(30_46_41/0.5)] ${frame}`}>
      <span className={`grid place-items-center overflow-hidden bg-brand-mist ${className}`}>
        {src ? <img src={src} alt={work.title} loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon className="size-6 text-gray-400" />}
      </span>
    </span>
  )
}
