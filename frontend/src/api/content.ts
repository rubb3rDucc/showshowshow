import { apiCall } from './client';
import type { SearchResponse, Content, QueueItem } from '../types/api';

/**
 * Search for content (shows/movies) via TMDB
 */
export async function searchContent(query: string, page: number = 1): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
  });
  
  return apiCall<SearchResponse>(`/api/content/search?${params}`);
}

/**
 * Get content details by TMDB ID
 * @param tmdbId - TMDB ID
 * @param type - Optional content type ('tv' or 'movie')
 */
export async function getContentByTmdbId(tmdbId: number, type?: 'tv' | 'movie'): Promise<Content> {
  const params = type ? `?type=${type}` : '';
  return apiCall<Content>(`/api/content/${tmdbId}${params}`);
}

/**
 * Get user's queue
 */
export async function getQueue(): Promise<QueueItem[]> {
  return apiCall<QueueItem[]>('/api/queue');
}

/**
 * Add content to queue
 */
export async function addToQueue(contentId: string): Promise<QueueItem> {
  return apiCall<QueueItem>('/api/queue', {
    method: 'POST',
    body: JSON.stringify({ content_id: contentId }),
  });
}

/**
 * Remove content from queue
 */
export async function removeFromQueue(queueItemId: string): Promise<void> {
  return apiCall<void>(`/api/queue/${queueItemId}`, {
    method: 'DELETE',
  });
}

