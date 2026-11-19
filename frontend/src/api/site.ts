/** Contenu du site : pages éditables, contact, newsletter, partenaires, compteur. Backend : apps/site_content. */
import { useQuery } from '@tanstack/react-query'
import { ApiError, api } from '@/lib/api'

export type PageSlug = 'terms' | 'about' | 'legal' | 'advertising'

export interface SitePage {
  slug: string
  lang: string
  title: string
  /** Texte ou Markdown */
  body: string
  updated_at: string
}

export interface Partner {
  id: number
  name: string
  logo: string | null
  url: string
}

export interface ContactInput {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

export const siteLang = (lang: string | undefined): 'fr' | 'en' => (lang?.startsWith('en') ? 'en' : 'fr')

export const getPage = (slug: PageSlug, lang: string) => api<SitePage>(`/site/pages/${slug}/`, { auth: false, query: { lang } })

/** Page éditable ; `null` si elle n'existe pas (404) ou est vide : la page garde alors son texte local */
export function useSitePage(slug: PageSlug, lang: string | undefined) {
  const l = siteLang(lang)
  return useQuery({
    queryKey: ['site', 'page', slug, l],
    queryFn: async () => {
      try {
        const page = await getPage(slug, l)
        return page.body?.trim() ? page : null
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export const sendContact = (input: ContactInput) => api<{ detail: string }>('/site/contact/', { method: 'POST', body: input, auth: false })

export const subscribeNewsletter = (email: string, language: 'fr' | 'en') =>
  api<{ detail: string }>('/site/newsletter/', { method: 'POST', body: { email, language }, auth: false })

export const unsubscribeNewsletter = (token: string) =>
  api<{ detail: string }>('/site/newsletter/unsubscribe/', { method: 'POST', body: { token }, auth: false })

export function usePartners() {
  return useQuery({
    queryKey: ['site', 'partners'],
    queryFn: () => api<Partner[]>('/site/partners/', { auth: false }),
    staleTime: 10 * 60_000,
    retry: false,
  })
}

export function useSiteStats() {
  return useQuery({
    queryKey: ['site', 'stats'],
    queryFn: () => api<{ artist_count: number }>('/site/stats/', { auth: false }),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
