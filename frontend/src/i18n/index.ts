import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
// Textes de l'espace artiste, dans des fichiers séparés
import dashboardEn from './locales/dashboard.en.json'
import dashboardFr from './locales/dashboard.fr.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
// Textes des pages fixes (Qui sommes-nous, CGU, etc.), dans des fichiers séparés
import pagesEn from './locales/pages.en.json'
import pagesFr from './locales/pages.fr.json'

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: { ...fr, ...pagesFr, ...dashboardFr } }, en: { translation: { ...en, ...pagesEn, ...dashboardEn } } },
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
