import { apiCall } from './client';
import type { SearchResponse, Content, QueueItem, Episode } from '../types/api';

/**
 * Search for content (shows/movies) via TMDB or Jikan
 * @param query - Search query string
 * @param page - Page number (default: 1)
 * @param includeAdult - Whether to include adult content (default: false)
 * @param source - Data source: 'tmdb' | 'jikan' | 'auto' (default: 'tmdb')
 */
export async function searchContent(
  query: string, 
  page: number = 1, 
  includeAdult: boolean = false,
  source: 'tmdb' | 'jikan' | 'auto' = 'tmdb'
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    include_adult: includeAdult.toString(),
    source: source,
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
 * Get content details by MAL ID (Jikan/MyAnimeList)
 * @param malId - MyAnimeList ID
 */
export async function getContentByMalId(malId: number): Promise<Content> {
  return apiCall<Content>(`/api/content/jikan/${malId}`);
}

/**
 * Get episodes for a show by content ID (supports both TMDB and Jikan)
 * @param contentId - Content ID (UUID)
 * @param season - Optional season number
 */
export async function getEpisodesByContentId(contentId: string, season?: number): Promise<Episode[]> {
  const params = season ? `?season=${season}` : '';
  return apiCall<Episode[]>(`/api/content/by-id/${contentId}/episodes${params}`);
}

/**
 * Get episodes for a show by TMDB ID (legacy, for backward compatibility)
 * @param tmdbId - TMDB ID
 * @param season - Optional season number
 */
export async function getEpisodes(tmdbId: number, season?: number): Promise<Episode[]> {
  const params = season ? `?season=${season}` : '';
  return apiCall<Episode[]>(`/api/content/${tmdbId}/episodes${params}`);
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
export async function addToQueue(data: { content_id: string; season?: number | null; episode?: number | null }): Promise<QueueItem> {
  return apiCall<QueueItem>('/api/queue', {
    method: 'POST',
    body: JSON.stringify(data),
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

/**
 * Toggle whether a queue item participates in schedule generation.
 * Keeps the item in the lineup; the generator skips it when is_active is false.
 */
export async function setQueueItemActive(
  queueItemId: string,
  isActive: boolean
): Promise<{ success: boolean; is_active: boolean }> {
  return apiCall(`/api/queue/${queueItemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
}

// Update a queue item's per-show scheduler flags (any subset).
export async function updateQueueItem(
  queueItemId: string,
  patch: {
    include_watched?: boolean;
    episode_order?: 'sequential' | 'shuffle';
    resume_from_last_watched?: boolean;
  }
): Promise<{ success: boolean }> {
  return apiCall(`/api/queue/${queueItemId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/**
 * Reorder queue items
 * @param itemIds - Array of queue item IDs in desired order
 */
export async function reorderQueue(itemIds: string[]): Promise<void> {
  return apiCall<void>('/api/queue/reorder', {
    method: 'PUT',
    body: JSON.stringify({ item_ids: itemIds }),
  });
}

/**
 * Refresh/update existing content (re-fetch from API)
 * @param contentId - Content ID (UUID)
 */
export async function refreshContent(contentId: string): Promise<Content> {
  return apiCall<Content>(`/api/content/${contentId}/refresh`, {
    method: 'PUT',
  });
}

