import { artists, freeGalleries, recommended, teamFavorites } from '@/mocks/homeData'
import type { PhotoKey } from '@/mocks/photos'
import type { Artist, Artwork } from '@/types/catalog'

// Données d'exemple pour la page d'un artiste. À remplacer par l'API.

export interface ArtistProfile {
  bio: string
  portrait?: PhotoKey
  villa: PhotoKey
  halls: PhotoKey[]
  memberSince: number
  /** Bureau de protection des droits d'auteur */
  copyrightOffice: string
  visits: number
  socials: { label: string; url: string }[]
}

const PROFILES: Record<string, ArtistProfile> = {
  'awa-kone': {
    bio: 'Née à Abidjan, Awa Koné peint la lumière de la lagune Ébrié et l’énergie des marchés du Plateau. Ses toiles, très colorées, mêlent couteau et pinceau dans une matière généreuse. Formée à l’INSAAC, elle expose depuis dix ans entre Abidjan, Dakar et Paris.',
    portrait: 'portrait_r2',
    villa: 'villa_v2',
    halls: ['hall_g1', 'hall_g3', 'hall_g5'],
    memberSince: 2024,
    copyrightOffice: 'BURIDA (Côte d’Ivoire)',
    visits: 12480,
    socials: [
      { label: 'Instagram', url: '#' },
      { label: 'Facebook', url: '#' },
      { label: 'Site web', url: '#' },
    ],
  },
  'moussa-diop': {
    bio: 'Photographe autodidacte, Moussa Diop parcourt les rues de Dakar et de Saint-Louis pour saisir les visages, les gestes et les rituels du quotidien.',
    portrait: 'portrait_r3',
    villa: 'villa_v3',
    halls: ['hall_g2', 'hall_g5', 'hall_g1'],
    memberSince: 2025,
    copyrightOffice: 'SODAV (Sénégal)',
    visits: 8310,
    socials: [{ label: 'Instagram', url: '#' }],
  },
  'esther-mbarga': {
    bio: 'Mosaïste et coloriste, Esther Mbarga transforme céramique, verre et tissus en grands panneaux lumineux inspirés des marchés de Douala.',
    portrait: 'portrait_r4',
    villa: 'villa_v4',
    halls: ['hall_g3', 'hall_g1', 'hall_g5'],
    memberSince: 2024,
    copyrightOffice: 'SOCAM (Cameroun)',
    visits: 9645,
    socials: [{ label: 'Instagram', url: '#' }, { label: 'Site web', url: '#' }],
  },
  'kofi-mensah': {
    bio: 'Sculpteur du bois et du bronze, Kofi Mensah perpétue les savoir-faire ashanti dans des figures contemporaines, sobres et puissantes.',
    portrait: 'portrait_r5',
    villa: 'villa_v5',
    halls: ['hall_g2', 'hall_g3', 'hall_g1'],
    memberSince: 2025,
    copyrightOffice: 'GHAMRO (Ghana)',
    visits: 6120,
    socials: [{ label: 'Facebook', url: '#' }],
  },
  'aminata-traore': {
    bio: 'Peintre de la vie des villages du Mali, Aminata Traoré compose de grandes scènes de fête et de travail, vibrantes de couleurs et de mouvement.',
    portrait: 'portrait_r6',
    villa: 'villa_v5',
    halls: ['hall_g1', 'hall_g3', 'hall_g5'],
    memberSince: 2024,
    copyrightOffice: 'BUMDA (Mali)',
    visits: 15230,
    socials: [{ label: 'Instagram', url: '#' }],
  },
  'ibrahim-ouedraogo': {
    bio: 'Peintre et teinturier, Ibrahim Ouédraogo marie le batik traditionnel du Burkina Faso à une peinture abstraite et lumineuse. Il ouvre gratuitement sa galerie pour faire découvrir son travail.',
    villa: 'villa_v3',
    halls: ['hall_g3', 'hall_g5', 'hall_g2'],
    memberSince: 2025,
    copyrightOffice: 'BBDA (Burkina Faso)',
    visits: 4820,
    socials: [{ label: 'Facebook', url: '#' }],
  },
  'nadia-hounsou': {
    bio: 'Sculptrice béninoise, Nadia Hounsou travaille le bronze et le bois autour des figures de la musique et de la transmission.',
    villa: 'villa_v2',
    halls: ['hall_g2', 'hall_g1', 'hall_g3'],
    memberSince: 2025,
    copyrightOffice: 'BUBEDRA (Bénin)',
    visits: 3970,
    socials: [{ label: 'Instagram', url: '#' }],
  },
  'yao-kouassi': {
    bio: 'Photographe de Bouaké, Yao Kouassi saisit les couleurs des marchés et la lumière du Sahel. Sa galerie est ouverte gratuitement à tous.',
    villa: 'villa_v4',
    halls: ['hall_g5', 'hall_g2', 'hall_g3'],
    memberSince: 2025,
    copyrightOffice: 'BURIDA (Côte d’Ivoire)',
    visits: 6410,
    socials: [{ label: 'Instagram', url: '#' }, { label: 'Site web', url: '#' }],
  },
}

const DEFAULT_PROFILE: Omit<ArtistProfile, 'bio'> = {
  villa: 'hero_villa',
  halls: ['hall_g1', 'hall_g2', 'hall_g3'],
  memberSince: 2025,
  copyrightOffice: 'Bureau national des droits d’auteur',
  visits: 3200,
  socials: [],
}

export function getArtist(id: string): { artist: Artist; profile: ArtistProfile; works: Artwork[] } | null {
  const artist = artists.find((a) => a.id === id)
  if (!artist) return null
  const profile = PROFILES[id] ?? {
    ...DEFAULT_PROFILE,
    bio: `${artist.name} expose ses œuvres sur AGAPY-GALLERY depuis ${artist.city}, ${artist.country}.`,
  }
  const seen = new Set<string>()
  const works = [...recommended, ...teamFavorites, ...freeGalleries].filter((w) => {
    if (w.artistId !== id || seen.has(w.id)) return false
    seen.add(w.id)
    return true
  })
  return { artist, profile, works }
}

/** Résumé d'une œuvre (exemple) */
export function artworkSummary(work: Artwork, artist: Artist): string {
  return `« ${work.title} » est une œuvre de ${artist.name}, réalisée à ${artist.city}. ${work.technique}, ${work.size[0]} × ${work.size[1]} cm.`
}
