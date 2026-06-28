import { apiCall } from './client';

/** A list item, resolved from the content table (cross-source). */
export interface ListItemAPI {
  content_id: string;
  title: string;
  poster_url: string | null;
  content_type: 'show' | 'movie';
  data_source: 'tmdb' | 'jikan' | 'anilist' | 'kitsu';
  tmdb_id: number | null;
  mal_id: number | null;
  position: number;
}

/** A list as returned by the overview endpoint (with a count + sample posters). */
export interface ListSummaryAPI {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  ranked: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
  posters: string[];
}

/** A list with its full ordered items. */
export interface ListDetailAPI {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  ranked: boolean;
  created_at: string;
  updated_at: string;
  items: ListItemAPI[];
}

export async function getLists(): Promise<ListSummaryAPI[]> {
  return apiCall<ListSummaryAPI[]>('/api/lists');
}

export async function getList(id: string): Promise<ListDetailAPI> {
  return apiCall<ListDetailAPI>(`/api/lists/${id}`);
}

export async function createList(input: {
  name: string;
  description?: string | null;
  ranked?: boolean;
}): Promise<ListSummaryAPI> {
  return apiCall<ListSummaryAPI>('/api/lists', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateList(
  id: string,
  input: { name?: string; description?: string | null; ranked?: boolean }
): Promise<ListSummaryAPI> {
  return apiCall<ListSummaryAPI>(`/api/lists/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteList(id: string): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>(`/api/lists/${id}`, { method: 'DELETE' });
}

export async function addListItems(id: string, contentIds: string[]): Promise<{ added: number }> {
  return apiCall<{ added: number }>(`/api/lists/${id}/items`, {
    method: 'POST',
    body: JSON.stringify({ content_ids: contentIds }),
  });
}

export async function removeListItem(id: string, contentId: string): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>(`/api/lists/${id}/items/${contentId}`, { method: 'DELETE' });
}

export async function reorderListItems(id: string, contentIds: string[]): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>(`/api/lists/${id}/items/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ content_ids: contentIds }),
  });
}
