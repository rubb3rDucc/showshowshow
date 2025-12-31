import { apiCall } from './client';

export interface Network {
  id: string;
  tmdb_network_id: number | null;
  name: string;
  logo_path: string | null;
  logo_url: string | null;
  origin_country: string | null;
  created_at: string;
}

export interface NetworkSearchResult {
  tmdb_id: number;
  name: string;
  logo_path: string | null;
  logo_url: string | null;
  origin_country: string | null;
  is_provider?: boolean; // True if it's a streaming provider, false if it's a TV network
}

export interface NetworkContent {
  network: Network;
  content: Array<{
    id: number;
    tmdb_id: number;
    title: string;
    poster_url: string | null;
    backdrop_url: string | null;
    overview: string;
    first_air_date: string;
    vote_average: number;
    vote_count: number;
    content_type: 'show' | 'movie';
  }>;
  page: number;
  total_pages: number;
  total_results: number;
}

/**
 * Get all featured networks
 */
export async function getNetworks(): Promise<Network[]> {
  return apiCall<Network[]>('/api/networks');
}

/**
 * Get a single network by ID
 */
export async function getNetwork(networkId: string): Promise<Network> {
  return apiCall<Network>(`/api/networks/${networkId}`);
}

/**
 * Get content from a specific network
 */
export async function getNetworkContent(networkId: string, page: number = 1): Promise<NetworkContent> {
  return apiCall<NetworkContent>(`/api/networks/${networkId}/content?page=${page}`);
}

/**
 * Search for networks in TMDB
 */
export async function searchNetworks(query: string, page: number = 1): Promise<{ results: NetworkSearchResult[]; page: number; total_pages: number; total_results: number }> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
  });
  return apiCall<{ results: NetworkSearchResult[]; page: number; total_pages: number; total_results: number }>(`/api/networks/search?${params}`);
}

/**
 * Add a new network to the database
 */
export async function addNetwork(tmdbNetworkId: number, isProvider: boolean = false): Promise<Network & { already_exists: boolean }> {
  return apiCall<Network & { already_exists: boolean }>('/api/networks', {
    method: 'POST',
    body: JSON.stringify({ tmdb_network_id: tmdbNetworkId, is_provider: isProvider }),
  });
}

/**
 * Delete a network from the database
 */
export async function deleteNetwork(id: string): Promise<{ success: boolean; deleted_network: string }> {
  return apiCall<{ success: boolean; deleted_network: string }>(`/api/networks/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Reorder networks
 */
export async function reorderNetworks(networkIds: string[]): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>('/api/networks/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ network_ids: networkIds }),
  });
}

