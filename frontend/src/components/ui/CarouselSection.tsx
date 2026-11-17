import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  cta?: { label: string; to: string }
  children: ReactNode
  tone?: 'light' | 'mist'
}

/** Section avec titre et carrousel horizontal (glisser au doigt, flèches sur ordinateur). */
export function CarouselSection({ eyebrow, title, subtitle, cta, children, tone = 'light' }: Props) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 })
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update])

  const scroll = (dir: 1 | -1) => {
    const el = track.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const arrow = 'grid size-10 place-items-center rounded-full border border-brand-graphite/15 text-brand-graphite transition hover:border-brand-green hover:bg-brand-green hover:text-white disabled:pointer-events-none disabled:opacity-30 dark:border-white/20 dark:text-white'

  return (
    <section className={tone === 'mist' ? 'bg-brand-mist py-20 dark:bg-night-card' : 'py-20'}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            actions={
              <>
                {cta && (
                  <Link to={cta.to} className="link mr-3 hidden text-sm font-semibold sm:inline">
                    {cta.label} →
                  </Link>
                )}
                <button type="button" onClick={() => scroll(-1)} disabled={edges.start} className={arrow} aria-label={t('common.previous')}>
                  <ChevronLeft className="size-4" />
                </button>
                <button type="button" onClick={() => scroll(1)} disabled={edges.end} className={arrow} aria-label={t('common.next')}>
                  <ChevronRight className="size-4" />
                </button>
              </>
            }
          />
        </Reveal>
        <div
          ref={track}
          onScroll={update}
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-4 px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6"
        >
          {children}
        </div>
        {cta && (
          <Link to={cta.to} className="link mt-4 inline-block text-sm font-semibold sm:hidden">
            {cta.label} →
          </Link>
        )}
      </div>
    </section>
  )
}
