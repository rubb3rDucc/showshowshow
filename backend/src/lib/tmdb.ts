import dotenv from 'dotenv';

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_API_BASE_URL = process.env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  console.warn('⚠️  TMDB_API_KEY not set in environment variables');
}

// TMDB API response types
export interface TMDBShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  episode_run_time: number[];
  genres: Array<{ id: number; name: string }>;
}

export interface TMDBSearchResult {
  id: number;
  name?: string; // For shows
  title?: string; // For movies
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date?: string; // For shows
  release_date?: string; // For movies
  media_type: 'tv' | 'movie';
}

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

export interface TMDBSeason {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  episodes: TMDBEpisode[];
}

// Fetch with error handling
async function fetchTMDB<T>(endpoint: string): Promise<T> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  const url = `${TMDB_API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json() as Promise<T>;
}

// Search for shows and movies
export async function searchTMDB(query: string, page: number = 1): Promise<TMDBSearchResponse> {
  const endpoint = `/search/multi?query=${encodeURIComponent(query)}&page=${page}`;
  return fetchTMDB<TMDBSearchResponse>(endpoint);
}

// Get TV show details
export async function getShowDetails(tmdbId: number): Promise<TMDBShow> {
  const endpoint = `/tv/${tmdbId}`;
  return fetchTMDB<TMDBShow>(endpoint);
}

// Get movie details
export async function getMovieDetails(tmdbId: number): Promise<TMDBMovie> {
  const endpoint = `/movie/${tmdbId}`;
  return fetchTMDB<TMDBMovie>(endpoint);
}

// Get show seasons
export async function getShowSeasons(tmdbId: number): Promise<TMDBSeason[]> {
  const show = await getShowDetails(tmdbId);
  const seasons: TMDBSeason[] = [];
  
  // Fetch each season
  for (let seasonNum = 0; seasonNum <= show.number_of_seasons; seasonNum++) {
    try {
      const season = await fetchTMDB<TMDBSeason>(`/tv/${tmdbId}/season/${seasonNum}`);
      seasons.push(season);
    } catch (error) {
      // Some seasons might not exist, skip them
      console.warn(`Season ${seasonNum} not found for show ${tmdbId}`);
    }
  }
  
  return seasons;
}

// Get specific season
export async function getSeason(tmdbId: number, seasonNumber: number): Promise<TMDBSeason> {
  const endpoint = `/tv/${tmdbId}/season/${seasonNumber}`;
  return fetchTMDB<TMDBSeason>(endpoint);
}

// Get image URL (TMDB uses relative paths)
export function getImageUrl(path: string | null, size: 'w500' | 'w780' | 'original' = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// Helper to determine content type from search result
export function getContentType(result: TMDBSearchResult): 'show' | 'movie' {
  return result.media_type === 'tv' ? 'show' : 'movie';
}

// Helper to get default duration
export function getDefaultDuration(
  content: TMDBShow | TMDBMovie,
  contentType: 'show' | 'movie'
): number {
  if (contentType === 'movie') {
    return (content as TMDBMovie).runtime || 120; // Default 2 hours for movies
  }
  
  // For shows, use first episode runtime or default
  const show = content as TMDBShow;
  if (show.episode_run_time && show.episode_run_time.length > 0) {
    return show.episode_run_time[0];
  }
  
  return 22; // Default 22 minutes for TV shows
}

