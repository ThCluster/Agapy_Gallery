import type { PhotoKey } from '@/mocks/photos'

/**
 * Photos de villa et de salles : l'API ne fournit pas encore d'images de la villa 3D,
 * on choisit des photos d'illustration selon l'adresse de l'artiste (toujours les mêmes pour un artiste).
 */
const VILLAS: PhotoKey[] = ['villa_v2', 'villa_v3', 'villa_v4', 'villa_v5']
const HALLS: PhotoKey[][] = [
  ['hall_g1', 'hall_g3', 'hall_g5'],
  ['hall_g2', 'hall_g5', 'hall_g1'],
  ['hall_g3', 'hall_g1', 'hall_g5'],
  ['hall_g2', 'hall_g3', 'hall_g1'],
]

const slot = (address: number) => Math.abs(address || 0) % VILLAS.length

export const villaPhoto = (address: number): PhotoKey => VILLAS[slot(address)]
export const hallPhotos = (address: number): PhotoKey[] => HALLS[slot(address)]
