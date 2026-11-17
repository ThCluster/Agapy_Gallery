// Généré automatiquement : photos Unsplash (licence Unsplash, usage commercial gratuit).
// Images provisoires en attendant les vraies œuvres des artistes AGAPY.

export interface Photo {
  src: string
  width: number
  height: number
  credit: string
}

export const photos = {
  hero_villa: { src: '/images/hero-villa.webp', width: 1920, height: 1281, credit: 'John Fornander' },
  hero_gallery: { src: '/images/hero-gallery.webp', width: 1920, height: 1074, credit: 'Declan Sun' },
  hero_hall: { src: '/images/hero-hall.webp', width: 1920, height: 1440, credit: 'Neon Wang' },
  art_a1: { src: '/images/art-a1.webp', width: 640, height: 854, credit: 'Jené Stephaniuk' },
  art_a3: { src: '/images/art-a3.webp', width: 640, height: 420, credit: 'Steve A Johnson' },
  art_a4: { src: '/images/art-a4.webp', width: 640, height: 640, credit: 'Steve A Johnson' },
  art_a5: { src: '/images/art-a5.webp', width: 640, height: 854, credit: 'Vojtech Bruzek' },
  art_a6: { src: '/images/art-a6.webp', width: 640, height: 800, credit: 'Geordanna Cordero' },
  art_a7: { src: '/images/art-a7.webp', width: 640, height: 850, credit: 'Steve A Johnson' },
  art_a8: { src: '/images/art-a8.webp', width: 640, height: 383, credit: 'The New York Public Library' },
  art_a9: { src: '/images/art-a9.webp', width: 640, height: 846, credit: 'The New York Public Library' },
  art_a10: { src: '/images/art-a10.webp', width: 640, height: 640, credit: 'Europeana' },
  art_a11: { src: '/images/art-a11.webp', width: 640, height: 480, credit: 'Jim Petkiewicz' },
  art_a12: { src: '/images/art-a12.webp', width: 640, height: 507, credit: 'The Cleveland Museum of Art' },
  art_a13: { src: '/images/art-a13.webp', width: 640, height: 854, credit: 'william wallace' },
  art_a14: { src: '/images/art-a14.webp', width: 640, height: 960, credit: 'Raissa Lara Lütolf' },
  art_a15: { src: '/images/art-a15.webp', width: 640, height: 480, credit: 'Laya Clode' },
  art_s1: { src: '/images/art-s1.webp', width: 640, height: 922, credit: 'The Cleveland Museum of Art' },
  art_s2: { src: '/images/art-s2.webp', width: 640, height: 1015, credit: 'The Cleveland Museum of Art' },
  art_s3: { src: '/images/art-s3.webp', width: 640, height: 854, credit: 'Haberdoedas' },
  art_s4: { src: '/images/art-s4.webp', width: 640, height: 854, credit: 'Haberdoedas' },
  art_p1: { src: '/images/art-p1.webp', width: 640, height: 426, credit: 'Mpumelelo Macu' },
  art_p2: { src: '/images/art-p2.webp', width: 640, height: 979, credit: 'nathaniel abadji' },
  art_p3: { src: '/images/art-p3.webp', width: 640, height: 472, credit: 'Ninno JackJr' },
  art_p4: { src: '/images/art-p4.webp', width: 640, height: 426, credit: 'mana5280' },
  art_p5: { src: '/images/art-p5.webp', width: 640, height: 426, credit: 'Damian Patkowski' },
  portrait_r1: { src: '/images/portrait-r1.webp', width: 640, height: 960, credit: 'Albert Luphahla' },
  portrait_r2: { src: '/images/portrait-r2.webp', width: 640, height: 960, credit: 'Albert Luphahla' },
  portrait_r3: { src: '/images/portrait-r3.webp', width: 640, height: 800, credit: 'Oladimeji Odunsi' },
  portrait_r4: { src: '/images/portrait-r4.webp', width: 640, height: 954, credit: 'Ben Masora' },
  portrait_r5: { src: '/images/portrait-r5.webp', width: 640, height: 1139, credit: 'Alexander Wark Feeney' },
  portrait_r6: { src: '/images/portrait-r6.webp', width: 640, height: 960, credit: 'Ben Masora' },
  hall_g1: { src: '/images/hall-g1.webp', width: 1000, height: 750, credit: 'Neon Wang' },
  hall_g2: { src: '/images/hall-g2.webp', width: 1000, height: 750, credit: 'Neon Wang' },
  hall_g3: { src: '/images/hall-g3.webp', width: 1000, height: 750, credit: 'Elliott Matthews' },
  hall_g5: { src: '/images/hall-g5.webp', width: 1000, height: 632, credit: 'Mick Haupt' },
  villa_v2: { src: '/images/villa-v2.webp', width: 1200, height: 800, credit: 'Florian Schmidinger' },
  villa_v3: { src: '/images/villa-v3.webp', width: 1200, height: 800, credit: 'John Fornander' },
  villa_v4: { src: '/images/villa-v4.webp', width: 1200, height: 800, credit: 'Frames For Your Heart' },
  villa_v5: { src: '/images/villa-v5.webp', width: 1200, height: 900, credit: 'Ярослав Алексеенко' },
} satisfies Record<string, Photo>

export type PhotoKey = keyof typeof photos
