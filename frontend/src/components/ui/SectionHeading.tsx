import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  /** Sur fond foncé */
  inverted?: boolean
}

/** Titre de section homogène : petit sur-titre, grand titre, sous-titre, actions à droite. */
export function SectionHeading({ eyebrow, title, subtitle, actions, inverted = false }: Props) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 sm:mb-10">
      <div className="max-w-2xl">
        {eyebrow && <p className={`eyebrow ${inverted ? 'text-brand-yellow' : ''}`}>{eyebrow}</p>}
        <h2
          className={`mt-2 text-3xl font-light tracking-tight sm:text-4xl ${inverted ? 'text-white' : 'text-brand-graphite dark:text-white'}`}
        >
          {title}
        </h2>
        {subtitle && <p className={`mt-3 text-[15px] leading-relaxed ${inverted ? 'text-white/75' : 'text-gray-500'}`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
