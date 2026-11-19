import { useEffect } from 'react'

const SITE = 'AGAPY-GALLERY'

/** Titre de l'onglet : « <titre> · AGAPY-GALLERY » (restauré en quittant la page) */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${SITE}` : SITE
    return () => {
      document.title = previous
    }
  }, [title])
}
