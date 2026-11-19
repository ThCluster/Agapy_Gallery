import { useTranslation } from 'react-i18next'

/** Temps écoulé depuis une date, dans la langue de l'interface */
export function useAgo() {
  const { i18n } = useTranslation()
  const rtf = new Intl.RelativeTimeFormat(i18n.resolvedLanguage, { numeric: 'auto' })
  return (iso: string | null | undefined) => {
    if (!iso) return ''
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
    if (minutes < 60) return rtf.format(-Math.max(0, minutes), 'minute')
    if (minutes < 24 * 60) return rtf.format(-Math.round(minutes / 60), 'hour')
    return rtf.format(-Math.round(minutes / (24 * 60)), 'day')
  }
}
