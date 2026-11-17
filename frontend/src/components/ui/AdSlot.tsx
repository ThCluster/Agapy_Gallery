import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** Formats publicitaires prévus au cahier des charges */
const SIZES = {
  '468x60': 'h-[60px] w-full max-w-[468px]', // bannière classique
  '336x280': 'h-[280px] w-full max-w-[336px]', // billboard
  '160x600': 'h-[600px] w-[160px]', // skyscraper
  '88x31': 'h-[31px] w-[88px]', // bouton
} as const

export type AdFormat = keyof typeof SIZES

/** Emplacement publicitaire, en attendant les campagnes des annonceurs. */
export function AdSlot({ format, className = '' }: { format: AdFormat; className?: string }) {
  const { t } = useTranslation()
  const small = format === '88x31'
  return (
    <Link
      to="/publicite"
      aria-label={t('ads.slot', { format: format.replace('x', ' × ') })}
      className={`group grid place-items-center border border-brand-graphite/10 bg-white text-center transition hover:border-brand-green/40 dark:border-white/10 dark:bg-night-card ${SIZES[format]} ${className}`}
    >
      {small ? (
        <span className="text-[9px] font-semibold tracking-wide text-gray-400 uppercase group-hover:text-brand-green">{t('ads.short')}</span>
      ) : (
        <span className="px-3">
          <span className="block text-[10px] font-semibold tracking-[0.2em] text-gray-400 uppercase">{t('ads.label')}</span>
          <span className="mt-1 block text-xs text-gray-500 group-hover:text-brand-green">
            {t('ads.cta')} · {format.replace('x', ' × ')}
          </span>
        </span>
      )}
    </Link>
  )
}

/**
 * Habillage de page : deux skyscrapers 160 × 600 qui restent visibles de chaque côté
 * du contenu, uniquement sur les très grands écrans (assez de place sans gêner la lecture).
 */
export function PageSkin() {
  return (
    <div aria-hidden={false} className="pointer-events-none fixed inset-x-0 top-28 z-10 hidden min-[1720px]:block">
      <div className="mx-auto flex max-w-[1680px] justify-between px-4">
        <AdSlot format="160x600" className="pointer-events-auto" />
        <AdSlot format="160x600" className="pointer-events-auto" />
      </div>
    </div>
  )
}
