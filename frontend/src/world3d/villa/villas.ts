import { getArtist, listArtists, type CatalogArtwork } from '@/api/catalog'
import { ApiError } from '@/lib/api'
import { getArtist as getMockArtist } from '@/mocks/artistProfiles'
import type { Artwork as MockArtwork } from '@/types/catalog'
import { TEMPLATES } from './templates'
import type { FrameKind, Hanging, VillaConfig } from './types'

/** Fiches de villa de démonstration, utilisées seulement si l'API ne répond pas */
const VILLAS: Record<string, Omit<VillaConfig, 'artistName' | 'address'>> = {
  'awa-kone': {
    artistId: 'awa-kone',
    template: 'lagune',
    wallTone: 'blanc',
    light: 'midi',
    welcome: 'Bonjour et bienvenue ! Je suis Awa Koné. Entrez, la lumière de la verrière est la plus belle pour regarder mes toiles. Suivez-moi.',
    hangings: [
      {
        slot: 'back-1', artworkId: 'lumiere-lagune', title: 'Lumière de la lagune', technique: 'Acrylique sur toile', size: [120, 90], photo: 'art_a1', frame: 'wood',
        comment: 'J’ai peint cette toile au bord de la lagune Ébrié, à l’aube. Le couteau laisse la matière vibrer comme l’eau sous le soleil.',
      },
      {
        slot: 'back-2', artworkId: 'harmattan', title: 'Harmattan', technique: 'Acrylique sur toile', size: [65, 100], photo: 'art_a3', frame: 'black',
        comment: 'Quand l’harmattan souffle, le ciel d’Abidjan devient bleu poudré. J’ai voulu garder cette lumière voilée, presque blanche.',
      },
      {
        slot: 'back-3', artworkId: 'saison-pluies', title: 'Saison des pluies', technique: 'Acrylique sur toile', size: [100, 75], photo: 'art_a5', frame: 'wood',
        comment: 'Les verts profonds et les traits sombres, ce sont les orages de juin. La toile est encore humide de cette saison.',
      },
      {
        slot: 'honneur', artworkId: 'sous-le-fromager', title: 'Sous le fromager', technique: 'Huile sur toile', size: [80, 100], photo: 'art_a12', frame: 'gold',
        comment: 'La pièce maîtresse de ma villa. Sous le grand fromager, tout le village se retrouve : c’est là que l’on raconte, que l’on règle les disputes, que l’on rit.',
      },
      {
        slot: 'front-3', artworkId: 'aube-rose', title: 'Aube rose', technique: 'Technique mixte', size: [100, 80], photo: 'art_a6', frame: 'gold',
        comment: 'Le rose, c’est la première heure du marché, quand les étals s’ouvrent. Les petites taches noires sont les passants pressés.',
      },
      {
        slot: 'front-2', artworkId: 'carnaval', title: 'Carnaval', technique: 'Acrylique sur toile', size: [120, 90], photo: 'art_a13', frame: 'black',
        comment: 'Chaque créature vient d’un conte que me racontait ma grand-mère. Cherchez le poisson : il guide les enfants perdus.',
      },
      {
        slot: 'front-1', artworkId: 'lagune-bleue', title: 'Lagune bleue', technique: 'Acrylique sur toile', size: [100, 100], photo: 'art_a4', frame: 'wood',
        comment: 'Une toile plus calme, peinte après une longue maladie. Le bleu m’a soignée.',
      },
    ],
  },
  'moussa-diop': {
    artistId: 'moussa-diop',
    template: 'lagune',
    wallTone: 'lin',
    light: 'soir',
    welcome: 'Bienvenue, je suis Moussa Diop. Ici, pas de toiles : des visages et des gestes de Dakar et de Saint-Louis. Venez, la lumière du soir leur va bien.',
    goodbye: 'Merci d’avoir regardé ces visages avec moi. Si une photo vous a parlé, votre don m’aide à repartir sur les routes. À bientôt !',
    tour: ['honneur', 'back-1', 'back-2', 'front-2', 'front-1'],
    hangings: [
      {
        slot: 'honneur', artworkId: 'porteuses', title: 'Les porteuses', technique: 'Tirage photo, édition limitée', size: [60, 90], photo: 'art_p3', frame: 'white',
        comment: 'Le marché de Saint-Louis, à six heures. Elles portent tout le quartier sur la tête, et elles rient. J’ai attendu trois matins pour cette lumière.',
      },
      {
        slot: 'back-1', artworkId: 'regard', title: 'Regard', technique: 'Tirage photo, édition limitée', size: [90, 60], photo: 'art_p2', frame: 'black',
        comment: 'Il m’a demandé pourquoi je voulais le photographier. Je lui ai répondu : pour votre regard. Il n’a plus bougé.',
      },
      {
        slot: 'back-2', artworkId: 'pirogues', title: 'Les pirogues', technique: 'Tirage photo, édition limitée', size: [60, 90], photo: 'art_p1', frame: 'black',
        comment: 'Les pêcheurs de Guet Ndar repartent avant l’aube. Les couleurs des pirogues, ce sont les noms des familles.',
      },
      {
        slot: 'front-2', artworkId: 'sortie-ecole', title: 'Sortie d’école', technique: 'Tirage photo, édition limitée', size: [60, 90], photo: 'art_p4', frame: 'white',
        comment: 'Quatre heures de l’après-midi : la rue appartient aux enfants. J’ai juste eu à me baisser à leur hauteur.',
      },
      {
        slot: 'front-1', artworkId: 'atelier-tailleur', title: 'L’atelier du tailleur', technique: 'Tirage photo, édition limitée', size: [60, 90], photo: 'art_p5', frame: 'black',
        comment: 'Le tailleur de mon quartier coud les boubous de la Tabaski depuis quarante ans. Regardez ses mains.',
      },
    ],
  },
}

const FRAME_IDS: FrameKind[] = ['wood', 'gold', 'black', 'white', 'none']

/** Œuvre à accrocher, quelle que soit sa source (API ou démonstration) */
interface Hangable {
  id: string
  title: string
  technique: string
  size: [number, number]
  image?: string
  photo?: MockArtwork['photo']
  frame?: string
  comment?: string
}

/** Cadre choisi par l'artiste, sinon un cadre proposé selon la technique */
function frameOf(work: Hangable): FrameKind {
  if (work.frame && (FRAME_IDS as string[]).includes(work.frame)) return work.frame as FrameKind
  const t = work.technique.toLowerCase()
  if (t.includes('photo')) return 'black'
  if (t.includes('sculpture')) return 'white'
  return 'wood'
}

/**
 * Accrochage automatique : la plus grande œuvre en paysage va au mur d'honneur,
 * les autres suivent le tour du hall. Utilisé tant que l'artiste n'a pas composé sa villa.
 */
export function autoHang(works: Hangable[]): Hanging[] {
  const slots = TEMPLATES.lagune.slots
  const feature = slots.find((s) => s.feature)
  const others = slots.filter((s) => !s.feature)
  const byArea = [...works].sort((a, b) => b.size[0] * b.size[1] - a.size[0] * a.size[1])
  const star = byArea.find((w) => w.size[1] >= w.size[0])
  const hangings: Hanging[] = []
  const place = (work: Hangable, slot: string) =>
    hangings.push({
      slot,
      artworkId: work.id,
      title: work.title,
      technique: work.technique,
      size: work.size,
      image: work.image,
      photo: work.photo,
      frame: frameOf(work),
      comment: work.comment || undefined,
    })

  if (star && feature) place(star, feature.id)
  works
    .filter((w) => w !== star)
    .slice(0, others.length)
    .forEach((w, i) => place(w, others[i].id))
  // Ordre de visite : le tour du hall, le mur d'honneur au milieu
  const order = slots.map((s) => s.id)
  return hangings.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot))
}

/**
 * Les textures WebGL exigent CORS : une image servie par l'hôte de l'API (ex. http://127.0.0.1:8010/media/…)
 * est refusée depuis le site. On la charge par le même chemin sur l'origine du site (proxy /media).
 */
function sameOriginMedia(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url, window.location.origin)
    return u.pathname.startsWith('/media/') ? u.pathname + u.search : url
  } catch {
    return undefined
  }
}

const fromApi = (w: CatalogArtwork): Hangable => ({
  id: w.id,
  title: w.title,
  technique: w.technique,
  size: w.size[0] > 0 && w.size[1] > 0 ? w.size : [100, 80],
  image: sameOriginMedia(w.image),
  frame: w.frame,
  comment: w.summary,
})

/** Villa de démonstration (données de maquette) */
function mockVilla(artistId: string): VillaConfig | null {
  const found = getMockArtist(artistId)
  if (!found) return null
  const { artist, works } = found
  const custom = VILLAS[artistId]
  if (custom) return { ...custom, artistName: artist.name, address: artist.address, free: true }
  if (works.length === 0) return null
  return {
    artistId,
    artistName: artist.name,
    address: artist.address,
    template: 'lagune',
    wallTone: 'blanc',
    light: 'midi',
    hangings: autoHang(works),
    auto: true,
    free: true,
  }
}

/** Villa d'un artiste réel : profil public et œuvres publiées (images /media/…) */
async function apiVilla(artistId: string): Promise<VillaConfig | null> {
  const artist = await getArtist(artistId)
  const works = artist.artworks.filter((w) => w.image)
  if (works.length === 0) return null
  return {
    artistId: artist.id,
    artistName: artist.name,
    address: artist.address,
    template: 'lagune',
    wallTone: 'blanc',
    light: 'midi',
    hangings: autoHang(works.map(fromApi)),
    auto: true,
    free: artist.free,
  }
}

const cache = new Map<string, Promise<VillaConfig | null>>()

/**
 * Fiche de villa d'un artiste, construite à partir de l'API. Les données de démonstration ne
 * servent qu'en repli, si l'API ne répond pas. Renvoie la même promesse à chaque appel (`use()` de React).
 */
export function getVilla(artistId: string): Promise<VillaConfig | null> {
  let p = cache.get(artistId)
  if (!p) {
    p = apiVilla(artistId).catch((e: unknown) => {
      // Artiste inconnu : pas de villa ; API injoignable : données de démonstration
      if (e instanceof ApiError && e.status === 404) return null
      return mockVilla(artistId)
    })
    cache.set(artistId, p)
  }
  return p
}

/** Villa de démonstration ouverte si l'API est injoignable */
export const VILLA_OF_THE_WEEK = 'awa-kone'

let weekly: Promise<string> | null = null

/** Villa ouverte depuis les boutons « Visiter » sans artiste précis : la plus visitée (gratuite de préférence) */
export function getVillaOfTheWeek(): Promise<string> {
  weekly ??= listArtists({ ordering: '-visits', page_size: 12 })
    .then((page) => {
      const withWorks = page.results.filter((a) => a.artwork_count > 0)
      // Une galerie gratuite de préférence : tout le monde peut y entrer
      return (withWorks.find((a) => a.free) ?? withWorks[0] ?? page.results[0])?.id ?? VILLA_OF_THE_WEEK
    })
    .catch(() => VILLA_OF_THE_WEEK)
  return weekly
}
