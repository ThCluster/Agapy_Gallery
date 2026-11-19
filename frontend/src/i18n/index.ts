import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
// Un fichier par domaine, fusionnés en profondeur dans une seule traduction
import authEn from './locales/auth.en.json'
import authFr from './locales/auth.fr.json'
import catalogEn from './locales/catalog.en.json'
import catalogFr from './locales/catalog.fr.json'
import contentEn from './locales/content.en.json'
import contentFr from './locales/content.fr.json'
// Textes de l'espace artiste
import dashboardEn from './locales/dashboard.en.json'
import dashboardFr from './locales/dashboard.fr.json'
import en from './locales/en.json'
// Messages des codes d'erreur de l'API (errors.<code>)
import errorsEn from './locales/errors.en.json'
import errorsFr from './locales/errors.fr.json'
import fr from './locales/fr.json'
// Textes des pages fixes (Qui sommes-nous, CGU, etc.)
import pagesEn from './locales/pages.en.json'
import pagesFr from './locales/pages.fr.json'

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const

type Tree = Record<string, unknown>
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Fusion en profondeur : plusieurs fichiers peuvent compléter la même section (ex. « errors ») */
function merge(...trees: Tree[]): Tree {
  const out: Tree = {}
  for (const tree of trees) {
    for (const [k, v] of Object.entries(tree)) out[k] = isTree(v) && isTree(out[k]) ? merge(out[k] as Tree, v) : v
  }
  return out
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: merge(fr, pagesFr, dashboardFr, errorsFr, authFr, catalogFr, contentFr) },
      en: { translation: merge(en, pagesEn, dashboardEn, errorsEn, authEn, catalogEn, contentEn) },
    },
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
