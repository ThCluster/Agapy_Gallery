/** Forum des artistes : lecture publique, écriture réservée aux artistes connectés. */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ApiError, api, type Page } from '@/lib/api'

export interface ForumCategory {
  id: number
  slug: string
  name: string
  description: string
  topic_count: number
}

export interface ForumAuthor {
  name: string
  artist_id: string | null
}

export interface ForumTopic {
  id: number
  title: string
  category: { slug: string; name: string }
  author: ForumAuthor
  created_at: string
  last_post_at: string | null
  post_count: number
  is_pinned: boolean
  is_locked: boolean
}

export interface ForumTopicDetail extends ForumTopic {
  body: string
}

export interface ForumPost {
  id: number
  author: ForumAuthor
  body: string
  created_at: string
}

export const FORUM_PAGE_SIZE = 20

const emptyPage = <T>(): Page<T> => ({ count: 0, next: null, previous: null, results: [] })

/** Tant que le forum n'est pas déployé (404), on affiche un état vide */
async function orEmpty<T>(p: Promise<T>, empty: T): Promise<T> {
  try {
    return await p
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return empty
    throw e
  }
}

export function useForumCategories() {
  return useQuery({
    queryKey: ['forum', 'categories'],
    queryFn: () => orEmpty(api<ForumCategory[]>('/forum/categories/', { auth: false }), []),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useForumTopics(params: { category?: string; q?: string; page?: number }) {
  return useQuery({
    queryKey: ['forum', 'topics', params],
    queryFn: () => orEmpty(api<Page<ForumTopic>>('/forum/topics/', { auth: false, query: params }), emptyPage<ForumTopic>()),
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useForumTopic(id: string | undefined) {
  return useQuery({
    queryKey: ['forum', 'topic', id],
    queryFn: () => api<ForumTopicDetail>(`/forum/topics/${id}/`, { auth: false }),
    enabled: !!id,
    retry: false,
  })
}

export function useForumPosts(id: string | undefined, page: number) {
  return useQuery({
    queryKey: ['forum', 'posts', id, page],
    queryFn: () => orEmpty(api<Page<ForumPost>>(`/forum/topics/${id}/posts/`, { auth: false, query: { page } }), emptyPage<ForumPost>()),
    enabled: !!id,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export const createTopic = (input: { category: string; title: string; body: string }) =>
  api<ForumTopicDetail>('/forum/topics/', { method: 'POST', body: input })

export const createPost = (topicId: number | string, body: string) =>
  api<ForumPost>(`/forum/topics/${topicId}/posts/`, { method: 'POST', body: { body } })

export const reportPost = (postId: number, reason: string) => api<void>(`/forum/posts/${postId}/report/`, { method: 'POST', body: { reason } })
