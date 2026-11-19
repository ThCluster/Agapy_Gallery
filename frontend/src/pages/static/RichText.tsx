import { Fragment, type ReactNode } from 'react'

/**
 * Affiche le texte d'une page éditable (texte simple ou Markdown léger) sans HTML brut :
 * titres (#, ##, ###), listes (- ou *), paragraphes, **gras**, *italique* et [liens](https://…).
 */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim())
        if (!lines.length) return null
        const heading = /^(#{1,3})\s+(.*)$/.exec(lines[0])
        if (heading && lines.length === 1) {
          const level = heading[1].length
          const cls = 'mt-10 font-light tracking-tight text-brand-graphite first:mt-0 dark:text-white'
          if (level === 1) return <h2 key={i} className={`${cls} text-3xl`}>{inline(heading[2])}</h2>
          if (level === 2) return <h2 key={i} className={`${cls} text-2xl`}>{inline(heading[2])}</h2>
          return <h3 key={i} className="mt-8 text-lg font-semibold text-brand-graphite dark:text-white">{inline(heading[2])}</h3>
        }
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="mt-4 space-y-2.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-3 leading-relaxed text-brand-ink dark:text-slate-300">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-orange" aria-hidden />
                  <span>{inline(l.replace(/^\s*[-*]\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }
        // Un titre suivi de texte dans le même bloc
        if (heading) {
          return (
            <Fragment key={i}>
              <RichText text={lines[0]} />
              <RichText text={lines.slice(1).join('\n')} />
            </Fragment>
          )
        }
        return (
          <p key={i} className="mt-4 leading-relaxed whitespace-pre-line text-brand-ink first:mt-0 dark:text-slate-300">
            {inline(lines.join('\n'))}
          </p>
        )
      })}
    </div>
  )
}

/** Gras, italique et liens (http, https, mailto ou chemins internes uniquement) */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={m.index}>{m[1]}</strong>)
    else if (m[2]) out.push(<em key={m.index}>{m[2]}</em>)
    else if (/^(https?:|mailto:|\/)/.test(m[4])) {
      out.push(
        <a key={m.index} href={m[4]} className="link" {...(m[4].startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[3]}
        </a>,
      )
    } else out.push(m[3])
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
