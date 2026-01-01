import { apiCall } from './client';

export interface Person {
  id: number;
  name: string;
  profile_url: string | null;
  biography: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  known_for_department: string | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_url: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_url: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface PersonWithCredits extends Person {
  cast: any[];
  crew_by_department: Record<string, any[]>;
}

export interface PersonSearchResult {
  tmdb_person_id: number;
  name: string;
  profile_url: string | null;
  known_for_department: string | null;
  known_for: any[];
}

export interface SearchPeopleResponse {
  results: PersonSearchResult[];
  page: number;
  total_pages: number;
  total_results: number;
}

/**
 * Search for people
 */
export async function searchPeople(query: string, page: number = 1): Promise<SearchPeopleResponse> {
  return apiCall<SearchPeopleResponse>(`/api/people/search?q=${encodeURIComponent(query)}&page=${page}`);
}

/**
 * Get person details and filmography
 */
export async function getPersonDetails(tmdbId: number): Promise<PersonWithCredits> {
  return apiCall<PersonWithCredits>(`/api/people/${tmdbId}`);
}

/**
 * Get credits for a specific content item
 */
export async function getContentCredits(tmdbId: number, contentType: 'show' | 'movie'): Promise<Credits> {
  return apiCall<Credits>(`/api/content/${contentType}/${tmdbId}/credits`);
}

