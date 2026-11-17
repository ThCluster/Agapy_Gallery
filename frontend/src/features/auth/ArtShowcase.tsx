import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Img } from '@/components/ui/Img'
import { artistById, recommended } from '@/mocks/homeData'
import { photos } from '@/mocks/photos'

// Œuvres accrochées tour à tour au mur
const PIECES = [recommended[0], recommended[2], recommended[4], recommended[5]]
const SLIDE_MS = 6000

/**
 * Une salle d'exposition : mur clair, spot de lumière, œuvre encadrée
 * avec passe-partout et cartel de musée. Les œuvres se succèdent en fondu.
 */
export function ArtShowcase() {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % PIECES.length), SLIDE_MS)
    return () => window.clearInterval(id)
  }, [])

  const piece = PIECES[index]
  const artist = artistById(piece.artistId)

  return (
    <div className="relative flex h-full min-h-[420px] flex-col items-center justify-center overflow-hidden bg-[#f4f1ec] px-4 py-14 sm:px-8 dark:bg-night-card">
      {/* Halo du spot au-dessus de l'œuvre */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3/4 bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_255_255/0.95),transparent_65%)]" />
      {/* Plinthe du mur */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#e8e2d8] to-transparent dark:from-night-field" />

      {/* Œuvres empilées : seule l'active est visible */}
      <div className="relative grid place-items-center">
        {PIECES.map((p, i) => {
          const ph = photos[p.photo]
          const tall = ph.height >= ph.width
          return (
            <figure
              key={p.id}
              aria-hidden={i !== index}
              className={`col-start-1 row-start-1 transition-all duration-[1400ms] ease-out ${i === index ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'}`}
            >
              {/* Cadre fin + passe-partout blanc */}
              <span className="block border-[8px] border-[#2b2b2b] bg-white p-4 shadow-[0_40px_80px_-30px_rgb(30_30_30/0.55),0_8px_20px_-8px_rgb(30_30_30/0.3)] sm:border-[10px] sm:p-8">
                <span className={`block overflow-hidden ${tall ? 'h-[280px] sm:h-[400px]' : 'w-[240px] sm:w-[440px]'}`} style={{ aspectRatio: `${ph.width} / ${ph.height}` }}>
                  <Img photo={p.photo} alt={p.title} priority={i === 0} className="h-full w-full object-cover" />
                </span>
              </span>
            </figure>
          )
        })}
      </div>

      {/* Cartel de musée */}
      <div key={piece.id} className="relative mt-10 w-64 animate-[agapy-fade-in_1s_ease-out] border-l-2 border-brand-orange bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:bg-night-field/80">
        <p className="text-sm font-semibold text-brand-graphite dark:text-white">{artist?.name}</p>
        <p className="text-sm text-brand-ink italic dark:text-slate-300">{piece.title}</p>
        <p className="mt-1 text-xs text-gray-500">{piece.technique}</p>
      </div>

      <div className="relative mt-6 flex gap-1.5" role="tablist" aria-label={t('login.showcase')}>
        {PIECES.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={p.title}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-7 bg-brand-green' : 'w-2.5 bg-brand-graphite/20 hover:bg-brand-graphite/40'}`}
          />
        ))}
      </div>
    </div>
  )
}
