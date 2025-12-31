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

