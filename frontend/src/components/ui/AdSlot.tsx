import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { type AdApiFormat, useAds } from '@/api/promotions'

/** Formats publicitaires prévus au cahier des charges */
const SIZES = {
  '468x60': 'h-[60px] w-full max-w-[468px]', // bannière classique
  '336x280': 'h-[280px] w-full max-w-[336px]', // billboard
  '160x600': 'h-[600px] w-[160px]', // skyscraper
  '88x31': 'h-[31px] w-[88px]', // bouton
} as const

export type AdFormat = keyof typeof SIZES

/** Nom du format côté API (/promotions/ads/?format=) */
const API_FORMATS: Record<AdFormat, AdApiFormat> = {
  '468x60': 'banner_468x60',
  '336x280': 'billboard_336x280',
  '160x600': 'skyscraper_160x600',
  '88x31': 'button_88x31',
}

/**
 * Espace publicitaire : affiche la campagne en cours pour ce format (`index` : rang de la campagne,
 * pour les boutons 88 × 31 affichés par trois), sinon l'emplacement « Votre publicité ici ».
 */
export function AdSlot({ format, index = 0, className = '' }: { format: AdFormat; index?: number; className?: string }) {
  const { t } = useTranslation()
  const { data: ads } = useAds(API_FORMATS[format])
  const ad = ads?.[index]
  const small = format === '88x31'

  if (ad) {
    return (
      <a
        href={ad.link_url || '#'}
        target="_blank"
        rel="sponsored noopener noreferrer"
        title={ad.advertiser}
        className={`relative block overflow-hidden border border-brand-graphite/10 bg-white dark:border-white/10 dark:bg-night-card ${SIZES[format]} ${className}`}
      >
        <img src={ad.image} alt={ad.alt_text || ad.advertiser} loading="lazy" className="h-full w-full object-cover" />
        {!small && (
          <span className="absolute top-1 right-1 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
            {t('ads.label')}
          </span>
        )}
      </a>
    )
  }

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

/** Lien publicitaire sûr : http(s) uniquement */
function safeLink(raw: string): string | undefined {
  try {
    const url = new URL(raw, window.location.origin)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

/**
 * Habillage de site (cahier des charges, p. 15) : la campagne « site_skin » en cours habille les
 * deux côtés de la page (une seule image, fixe, visible de part et d'autre du contenu). Sans
 * campagne : deux skyscrapers 160 × 600. Uniquement sur les très grands écrans.
 */
export function PageSkin() {
  const { t } = useTranslation()
  const { data: skins } = useAds('site_skin')
  const skin = skins?.[0]

  if (skin) {
    const href = safeLink(skin.link_url)
    const style = { backgroundImage: `url("${encodeURI(skin.image)}")`, backgroundAttachment: 'fixed', backgroundSize: 'cover', backgroundPosition: 'top center' }
    const side = 'fixed top-0 bottom-0 z-10 hidden w-[calc((100vw-1360px)/2)] min-[1720px]:block'
    return (
      <>
        {(['left-0', 'right-0'] as const).map((pos) => (
          <a
            key={pos}
            href={href ?? '/publicite'}
            target={href ? '_blank' : undefined}
            rel="sponsored noopener noreferrer"
            title={skin.advertiser}
            aria-label={`${t('ads.label')} · ${skin.alt_text || skin.advertiser}`}
            className={`${side} ${pos}`}
            style={style}
          />
        ))}
      </>
    )
  }

  return (
    <div aria-hidden={false} className="pointer-events-none fixed inset-x-0 top-28 z-10 hidden min-[1720px]:block">
      <div className="mx-auto flex max-w-[1680px] justify-between px-4">
        <AdSlot format="160x600" className="pointer-events-auto" />
        <AdSlot format="160x600" index={1} className="pointer-events-auto" />
      </div>
    </div>
  )
}
