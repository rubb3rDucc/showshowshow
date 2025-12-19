import { apiCall } from './client';
import type { 
  LibraryItem, 
  LibraryStatsAPI, 
  EpisodeStatusItem,
  CreateLibraryItemRequest,
  UpdateLibraryItemRequest,
  MarkEpisodeRequest,
  MarkSeasonRequest,
  MarkAllEpisodesRequest,
} from '../types/library.types';

/**
 * Get user's library items
 * @param status - Filter by status (optional)
 * @param type - Filter by type: 'show' | 'movie' (optional)
 * @param search - Search query (optional)
 */
export async function getLibrary(
  status?: string,
  type?: 'show' | 'movie',
  search?: string
): Promise<LibraryItem[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (type) params.append('type', type);
  if (search) params.append('search', search);
  
  const queryString = params.toString();
  return apiCall<LibraryItem[]>(`/api/library${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get library statistics
 */
export async function getLibraryStats(): Promise<LibraryStatsAPI> {
  return apiCall<LibraryStatsAPI>('/api/library/stats');
}

/**
 * Get a single library item by ID
 */
export async function getLibraryItem(id: string): Promise<LibraryItem> {
  return apiCall<LibraryItem>(`/api/library/${id}`);
}

/**
 * Check if content is in library
 */
export async function checkLibrary(contentId: string): Promise<{ in_library: boolean; library_item?: LibraryItem }> {
  return apiCall<{ in_library: boolean; library_item?: LibraryItem }>(`/api/library/check/${contentId}`);
}

/**
 * Add content to library
 */
export async function addToLibrary(data: CreateLibraryItemRequest): Promise<LibraryItem> {
  return apiCall<LibraryItem>('/api/library', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update library item
 */
export async function updateLibraryItem(id: string, data: UpdateLibraryItemRequest): Promise<LibraryItem> {
  return apiCall<LibraryItem>(`/api/library/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Remove item from library
 */
export async function removeFromLibrary(id: string): Promise<void> {
  return apiCall<void>(`/api/library/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Get episode statuses for a content item
 */
export async function getEpisodeStatuses(contentId: string): Promise<EpisodeStatusItem[]> {
  return apiCall<EpisodeStatusItem[]>(`/api/library/${contentId}/episodes`);
}

/**
 * Mark an episode as watched/unwatched/skipped
 */
export async function markEpisode(contentId: string, data: MarkEpisodeRequest): Promise<{ success: boolean; library_item: LibraryItem }> {
  return apiCall<{ success: boolean; library_item: LibraryItem }>(`/api/library/${contentId}/episodes/mark`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Mark all episodes in a season
 */
export async function markSeason(contentId: string, data: MarkSeasonRequest): Promise<{ success: boolean; episodes_marked: number }> {
  return apiCall<{ success: boolean; episodes_marked: number }>(`/api/library/${contentId}/episodes/mark-season`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Mark all episodes as watched/unwatched
 */
export async function markAllEpisodes(contentId: string, data: MarkAllEpisodesRequest): Promise<{ success: boolean; episodes_marked: number }> {
  return apiCall<{ success: boolean; episodes_marked: number }>(`/api/library/${contentId}/episodes/mark-all`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

