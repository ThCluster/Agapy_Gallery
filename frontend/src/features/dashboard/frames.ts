import type { FrameId } from '@/stores/artistSpace'

export type { FrameId }

/** Cadres proposés (mêmes valeurs que GET /catalog/frames/) */
export const FRAMES: FrameId[] = ['black', 'wood', 'gold', 'white', 'none']

/** Cadres virtuels proposés aux artistes pour embellir leurs œuvres (cahier des charges, p. 4) */
export const FRAME_CLASS: Record<FrameId, string> = {
  black: 'border-[8px] border-[#2b2b2b] bg-white p-4',
  wood: 'border-[10px] border-[#9c6b43] bg-[#fbf7f0] p-4 shadow-[inset_0_0_0_2px_rgb(0_0_0/0.12)]',
  gold: 'border-[10px] border-[#c9a24a] bg-white p-4 shadow-[inset_0_0_0_3px_rgb(120_90_20/0.35)]',
  white: 'border-[8px] border-white bg-white p-3 ring-1 ring-black/10',
  none: 'p-0',
}

/** Couleur de la pastille de chaque cadre dans le sélecteur */
export const FRAME_SWATCH: Record<FrameId, string> = {
  black: '#2b2b2b',
  wood: '#9c6b43',
  gold: '#c9a24a',
  white: '#ffffff',
  none: 'transparent',
}
