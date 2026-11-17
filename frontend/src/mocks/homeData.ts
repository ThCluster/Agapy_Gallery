import type { Artist, Artwork, Clip, Interview } from '@/types/catalog'

// Données d'exemple : artistes fictifs illustrés par des photos Unsplash.
// À remplacer par l'API (et par les vraies œuvres) avant la mise en ligne.

export const artists: Artist[] = [
  { id: 'awa-kone', name: 'Awa Koné', discipline: 'peinture', city: 'Abidjan', country: "Côte d'Ivoire", address: 12, cover: 'art_a1' },
  { id: 'moussa-diop', name: 'Moussa Diop', discipline: 'photographie', city: 'Dakar', country: 'Sénégal', address: 18, cover: 'art_p2' },
  { id: 'esther-mbarga', name: 'Esther Mbarga', discipline: 'peinture', city: 'Douala', country: 'Cameroun', address: 24, cover: 'art_a11' },
  { id: 'kofi-mensah', name: 'Kofi Mensah', discipline: 'sculpture', city: 'Accra', country: 'Ghana', address: 31, cover: 'art_s1' },
  { id: 'aminata-traore', name: 'Aminata Traoré', discipline: 'peinture', city: 'Bamako', country: 'Mali', address: 37, cover: 'art_a8' },
  { id: 'ibrahim-ouedraogo', name: 'Ibrahim Ouédraogo', discipline: 'peinture', city: 'Ouagadougou', country: 'Burkina Faso', address: 42, cover: 'art_a10', free: true, freeUntil: '2027-01-15' },
  { id: 'nadia-hounsou', name: 'Nadia Hounsou', discipline: 'sculpture', city: 'Cotonou', country: 'Bénin', address: 49, cover: 'art_s3', free: true, freeUntil: '2026-12-31' },
  { id: 'yao-kouassi', name: 'Yao Kouassi', discipline: 'photographie', city: 'Bouaké', country: "Côte d'Ivoire", address: 53, cover: 'art_p4', free: true },
]

const T = {
  acrylique: 'Acrylique sur toile',
  huile: 'Huile sur toile',
  mixte: 'Technique mixte',
  batik: 'Batik sur coton',
  mosaique: 'Mosaïque',
  photo: 'Tirage photo, édition limitée',
  bois: 'Sculpture en bois',
  bronze: 'Sculpture en bronze',
}

export const recommended: Artwork[] = [
  { id: 'lumiere-lagune', title: 'Lumière de la lagune', artistId: 'awa-kone', technique: T.acrylique, size: [120, 90], photo: 'art_a1', recommended: true },
  { id: 'regard', title: 'Regard', artistId: 'moussa-diop', technique: T.photo, size: [90, 60], photo: 'art_p2', recommended: true },
  { id: 'soleil-marche', title: 'Le soleil du marché', artistId: 'esther-mbarga', technique: T.mosaique, size: [80, 110], photo: 'art_a11', recommended: true },
  { id: 'gardien', title: 'Le gardien assis', artistId: 'kofi-mensah', technique: T.bois, size: [62, 28], photo: 'art_s1', recommended: true },
  { id: 'danse-village', title: 'La danse du village', artistId: 'aminata-traore', technique: T.huile, size: [70, 105], photo: 'art_a8', recommended: true },
  { id: 'fils-tisserand', title: 'Fils du tisserand', artistId: 'ibrahim-ouedraogo', technique: T.batik, size: [100, 100], photo: 'art_a10', recommended: true },
  { id: 'joueur-kora', title: 'Le joueur de kora', artistId: 'nadia-hounsou', technique: T.bronze, size: [75, 30], photo: 'art_s3', recommended: true },
  { id: 'marche-bouake', title: 'Marché de Bouaké', artistId: 'yao-kouassi', technique: T.photo, size: [60, 90], photo: 'art_p4', recommended: true },
]

export const teamFavorites: Artwork[] = [
  { id: 'harmattan', title: 'Harmattan', artistId: 'awa-kone', technique: T.acrylique, size: [65, 100], photo: 'art_a3' },
  { id: 'sous-le-fromager', title: 'Sous le fromager', artistId: 'aminata-traore', technique: T.huile, size: [80, 100], photo: 'art_a12' },
  { id: 'deux-silhouettes', title: 'Deux silhouettes', artistId: 'esther-mbarga', technique: T.mixte, size: [100, 100], photo: 'art_a9' },
  { id: 'porteuses', title: 'Les porteuses', artistId: 'moussa-diop', technique: T.photo, size: [60, 90], photo: 'art_p3' },
  { id: 'carnaval', title: 'Carnaval', artistId: 'ibrahim-ouedraogo', technique: T.acrylique, size: [120, 90], photo: 'art_a13' },
  { id: 'saison-pluies', title: 'Saison des pluies', artistId: 'awa-kone', technique: T.acrylique, size: [100, 75], photo: 'art_a5' },
  { id: 'reine-mere', title: 'Reine mère', artistId: 'nadia-hounsou', technique: T.bois, size: [55, 30], photo: 'art_s2' },
  { id: 'savane', title: 'Mémoire de la savane', artistId: 'esther-mbarga', technique: T.huile, size: [120, 80], photo: 'art_a14' },
]

export const freeGalleries: Artwork[] = [
  { id: 'lagune-bleue', title: 'Lagune bleue', artistId: 'ibrahim-ouedraogo', technique: T.acrylique, size: [100, 100], photo: 'art_a4' },
  { id: 'aube-rose', title: 'Aube rose', artistId: 'yao-kouassi', technique: T.mixte, size: [100, 80], photo: 'art_a6' },
  { id: 'encre', title: 'Encre et lumière', artistId: 'ibrahim-ouedraogo', technique: T.acrylique, size: [90, 70], photo: 'art_a7' },
  { id: 'crepuscule', title: 'Crépuscule au Sahel', artistId: 'yao-kouassi', technique: T.photo, size: [60, 90], photo: 'art_p5' },
  { id: 'le-sage', title: 'Le sage', artistId: 'ibrahim-ouedraogo', technique: T.huile, size: [60, 80], photo: 'art_a15' },
  { id: 'souffle', title: 'Le souffle', artistId: 'yao-kouassi', technique: T.bois, size: [70, 25], photo: 'art_s4' },
  // Même titre qu'une œuvre d'Awa Koné : sert à tester l'aide en cas d'homonymes (cahier des charges, p. 10)
  { id: 'harmattan-yao', title: 'Harmattan', artistId: 'yao-kouassi', technique: T.photo, size: [60, 90], photo: 'art_p1' },
]

export const interviews: Interview[] = [
  { id: 'i1', artistId: 'awa-kone', role: 'peintre de la lumière ivoirienne', portrait: 'portrait_r2' },
  { id: 'i2', artistId: 'moussa-diop', role: 'photographe des visages du Sénégal', portrait: 'portrait_r3' },
  { id: 'i3', artistId: 'esther-mbarga', role: 'mosaïste et pédagogue', portrait: 'portrait_r4' },
  { id: 'i4', artistId: 'kofi-mensah', role: 'sculpteur du bois et du bronze', portrait: 'portrait_r5' },
]

/** Clips publicitaires de 30 s (jusqu'à 50 diffusés en boucle pendant 24 h) */
export const clips: Clip[] = [
  { id: 'c1', title: 'Exposition « Lumières d’Abidjan »', advertiser: 'Awa Koné', poster: 'hero_gallery' },
  { id: 'c2', title: 'Festival des arts de Dakar', advertiser: 'Biennale Dak’Art', poster: 'art_p1' },
  { id: 'c3', title: 'Atelier de sculpture sur bois', advertiser: 'Kofi Mensah', poster: 'art_s2' },
  { id: 'c4', title: 'Nouvelle collection batik', advertiser: 'Ibrahim Ouédraogo', poster: 'art_a10' },
  { id: 'c5', title: 'Visite de la villa Mbarga', advertiser: 'Esther Mbarga', poster: 'hall_g1' },
  { id: 'c6', title: 'Concert au jardin des sculptures', advertiser: 'Fondation Sahel Arts', poster: 'villa_v3' },
]

export const artistById = (id: string) => artists.find((a) => a.id === id)

/** Toutes les œuvres, sans doublon */
export const allWorks: Artwork[] = (() => {
  const seen = new Set<string>()
  return [...recommended, ...teamFavorites, ...freeGalleries].filter((w) => {
    if (seen.has(w.id)) return false
    seen.add(w.id)
    return true
  })
})()
