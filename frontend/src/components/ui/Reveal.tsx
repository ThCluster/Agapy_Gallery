import type { ReactNode } from 'react'

/**
 * Fait apparaître son contenu en douceur quand il entre à l'écran.
 * Animation 100 % CSS (voir .reveal dans index.css) : le contenu reste visible
 * dans les navigateurs qui ne la gèrent pas, il ne peut jamais rester caché.
 */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>
}
