import { apiCall } from './client';
import type { SearchResponse } from '../types/api';
import type { DiscoverFilters } from '../components/discover/discoverTypes';

/** Runtime preset key -> TMDB with_runtime.gte/.lte minutes. */
const RUNTIME_MAP: Record<string, { gte?: number; lte?: number }> = {
  lt30: { lte: 29 },
  '30to60': { gte: 30, lte: 60 },
  '60to90': { gte: 60, lte: 90 },
  gt120: { gte: 120 },
};

/** Content-rating bucket -> representative TMDB (movie) certification. */
const CERT_MAP: Record<string, string> = { family: 'PG', teen: 'PG-13', mature: 'R' };

export interface DiscoverGenre {
  name: string;
  tv_id: number | null;
  movie_id: number | null;
}

export interface ProviderOption {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface CompanyOption {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface PersonOption {
  id: number;
  name: string;
  profile_url: string | null;
  department: 'cast' | 'crew';
}

export async function getDiscoverGenres(): Promise<{ tv: DiscoverGenre[]; movie: DiscoverGenre[]; unified: DiscoverGenre[] }> {
  return apiCall('/api/discover/genres');
}

export async function getDiscoverProviders(): Promise<{ results: ProviderOption[] }> {
  return apiCall('/api/discover/providers');
}

export async function searchDiscoverCompanies(q: string): Promise<{ results: CompanyOption[] }> {
  return apiCall(`/api/discover/companies?q=${encodeURIComponent(q)}`);
}

export async function searchDiscoverPeople(q: string): Promise<{ results: PersonOption[] }> {
  return apiCall(`/api/discover/people?q=${encodeURIComponent(q)}`);
}

/** Serialize the filter state into /api/discover query params. */
export function buildDiscoverParams(f: DiscoverFilters, page: number): URLSearchParams {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('type', f.type);
  if (f.genres.length) p.set('genres', f.genres.join(','));
  if (f.yearRange) {
    p.set('year_gte', String(f.yearRange[0]));
    p.set('year_lte', String(f.yearRange[1]));
  }
  if (f.minRating) p.set('min_rating', String(f.minRating));
  if (f.sort) p.set('sort', f.sort);
  if (f.provider) p.set('provider', f.provider.id);
  if (f.studios.length) p.set('studio', f.studios.map((s) => s.id).join(','));

  const cast = f.people.filter((x) => x.department === 'cast').map((x) => x.id);
  const crew = f.people.filter((x) => x.department === 'crew').map((x) => x.id);
  if (cast.length) p.set('cast', cast.join(','));
  if (crew.length) p.set('crew', crew.join(','));

  if (f.language) p.set('language', f.language);
  if (f.runtime && RUNTIME_MAP[f.runtime]) {
    const r = RUNTIME_MAP[f.runtime];
    if (r.gte) p.set('runtime_gte', String(r.gte));
    if (r.lte) p.set('runtime_lte', String(r.lte));
  }
  if (f.certification && CERT_MAP[f.certification]) p.set('certification', CERT_MAP[f.certification]);
  if (f.upcoming) p.set('upcoming', 'true');
  p.set('include_adult', String(!f.hideAdult));
  return p;
}

export async function getDiscover(f: DiscoverFilters, page: number): Promise<SearchResponse> {
  return apiCall<SearchResponse>(`/api/discover?${buildDiscoverParams(f, page).toString()}`);
}
