/**
 * Anime API Client
 * Speaks the Jikan v4 schema (unofficial MyAnimeList data), which several
 * providers serve. The provider is config, not code:
 *   ANIME_API_BASE_URL    any Jikan v4-compatible base URL
 *   ANIME_API_ENABLED     "true" turns anime lookups on; otherwise they fail fast (503)
 *   ANIME_API_TIMEOUT_MS  per-request timeout
 * The public Jikan API (api.jikan.moe) was discontinued on 2026-10-01. The
 * default base URL is Tenrai (https://tenrai.org, public tier 4 req/sec), but
 * anime stays opt-in until a provider passes `pnpm test:contract:anime`.
 */

import { createExternalApi } from './external-api.js';

export const ANIME_API_BASE_URL = (process.env.ANIME_API_BASE_URL || 'https://api.tenrai.org/v1').replace(/\/$/, '');

const animeApi = createExternalApi({
  name: 'Anime API',
  timeoutMs: parseInt(process.env.ANIME_API_TIMEOUT_MS || '8000', 10),
  enabled: process.env.ANIME_API_ENABLED === 'true',
  minIntervalMs: 350, // slightly over 3 req/sec
  probe: () => rateLimitedFetch(`${ANIME_API_BASE_URL}/anime/1`),
});

async function rateLimitedFetch(url: string): Promise<Response> {
  const response = await animeApi.request(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Anime API rate limit exceeded. Please wait a moment.');
    }
    if (response.status === 404) {
      throw new Error('Anime not found');
    }
    throw new Error(`Anime API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

// Search anime
export async function searchJikan(query: string, page: number = 1): Promise<any> {
  const url = `${ANIME_API_BASE_URL}/anime?q=${encodeURIComponent(query)}&page=${page}&limit=25`;
  const response = await rateLimitedFetch(url);
  const data = await response.json() as any;
  
  return {
    results: data.data || [],
    page: data.pagination?.current_page || page,
    total_pages: data.pagination?.last_visible_page || 1,
    total_results: data.pagination?.items?.total || 0,
  };
}

// Get anime details by MAL ID
export async function getAnimeDetails(malId: number): Promise<any> {
  const url = `${ANIME_API_BASE_URL}/anime/${malId}/full`;
  const response = await rateLimitedFetch(url);
  const data = await response.json() as any;
  
  return data.data;
}

// Get anime episodes by MAL ID
export async function getAnimeEpisodes(malId: number, page: number = 1): Promise<any> {
  const url = `${ANIME_API_BASE_URL}/anime/${malId}/episodes?page=${page}`;
  const response = await rateLimitedFetch(url);
  const data = await response.json() as any;
  
  return {
    episodes: data.data || [],
    pagination: data.pagination || { last_visible_page: 1 },
  };
}

// Transform Jikan anime data to our content format
export function jikanToContentFormat(jikanAnime: any): {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  content_type: 'show' | 'movie';
  release_date: Date | null;
  first_air_date: Date | null;
  number_of_episodes: number | null;
  number_of_seasons: number | null;
  default_duration: number;
  status: string | null;
  rating: string | null;
} {
  // Jikan provides full image URLs, so we can use them directly
  const posterUrl = jikanAnime.images?.jpg?.large_image_url || 
                    jikanAnime.images?.jpg?.image_url || 
                    null;
  
  const backdropUrl = jikanAnime.images?.jpg?.large_image_url || 
                      jikanAnime.images?.jpg?.image_url || 
                      null;

  // Parse dates
  const startDate = jikanAnime.aired?.from 
    ? new Date(jikanAnime.aired.from) 
    : null;

  // Detect if it's a movie based on type field
  // Jikan types: "TV", "Movie", "OVA", "ONA", "Special", "Music"
  const isMovie = jikanAnime.type === 'Movie';

  // Determine default duration
  // For movies: duration is total runtime (e.g., "120 min")
  // For shows: duration is per episode (e.g., "24 min per ep")
  // Movies: total runtime ("2 hr 4 min"). Shows: per episode ("24 min per ep").
  const defaultDuration = parseDurationMinutes(jikanAnime.duration) ?? (isMovie ? 120 : 24);

  // Map status
  let status: string | null = null;
  if (jikanAnime.status) {
    // Jikan statuses: "Not yet aired", "Currently Airing", "Finished Airing"
    status = jikanAnime.status.toLowerCase().replace(/\s+/g, '_');
  }

  // Extract rating (Jikan provides ratings like "TV-14", "TV-MA", "R", "PG-13", etc.)
  const rating = normalizeJikanRating(jikanAnime.rating);

  return {
    mal_id: jikanAnime.mal_id,
    title: jikanAnime.title || jikanAnime.title_english || jikanAnime.title_japanese || 'Unknown',
    title_english: jikanAnime.title_english || null,
    title_japanese: jikanAnime.title_japanese || null,
    overview: jikanAnime.synopsis || null,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
    content_type: isMovie ? 'movie' : 'show',
    release_date: isMovie ? startDate : null, // Movies use release_date
    first_air_date: isMovie ? null : startDate, // Shows use first_air_date
    number_of_episodes: isMovie ? null : (jikanAnime.episodes || null), // Movies don't have episodes
    number_of_seasons: null, // Jikan doesn't have seasons concept
    default_duration: defaultDuration,
    status: status,
    rating: rating,
  };
}

// Transform Jikan search result to our search result format
export function jikanSearchToSearchResult(jikanAnime: any): {
  mal_id: number;
  tmdb_id: null;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  content_type: 'tv' | 'movie';
  media_type: 'tv' | 'movie';
  release_date: string | null;
  vote_average: number;
  popularity: number;
  data_source: 'jikan';
  rating: string | null;
} {
  const posterUrl = jikanAnime.images?.jpg?.large_image_url || 
                    jikanAnime.images?.jpg?.image_url || 
                    null;

  // Detect if it's a movie based on type field
  const isMovie = jikanAnime.type === 'Movie';

  return {
    mal_id: jikanAnime.mal_id,
    tmdb_id: null,
    title: jikanAnime.title || jikanAnime.title_english || jikanAnime.title_japanese || 'Unknown',
    title_english: jikanAnime.title_english || null,
    title_japanese: jikanAnime.title_japanese || null,
    overview: jikanAnime.synopsis || null,
    poster_url: posterUrl,
    backdrop_url: posterUrl, // Use same image for backdrop
    content_type: isMovie ? 'movie' : 'tv',
    media_type: isMovie ? 'movie' : 'tv',
    release_date: jikanAnime.aired?.from || null,
    vote_average: jikanAnime.score || 0,
    popularity: jikanAnime.popularity || 0,
    data_source: 'jikan',
    rating: normalizeJikanRating(jikanAnime.rating),
  };
}

// Parse MAL durations like "24 min per ep", "2 hr 4 min" or "1 hr" into minutes
function parseDurationMinutes(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const hours = duration.match(/(\d+)\s*hr/);
  const minutes = duration.match(/(\d+)\s*min/);
  if (!hours && !minutes) return null;
  return (hours ? parseInt(hours[1], 10) * 60 : 0) + (minutes ? parseInt(minutes[1], 10) : 0);
}

// Normalize Jikan rating to just the code (e.g., "TV-14", "R", "PG-13")
// Uses the shared normalizeRating function for consistency
function normalizeJikanRating(rating: string | null | undefined): string | null {
  if (!rating) return null;
  
  // Import normalizeRating (circular import risk, so we'll inline the logic)
  // Jikan ratings can come in formats like:
  // - "TV-14" -> "TV-14"
  // - "R - 17+ (violence & profanity)" -> "R"
  // - "PG-13 – TEENS 13 OR OLDER" -> "PG-13"
  
  const trimmed = rating.trim();
  
  // Match at the start of the string
  const startMatch = trimmed.match(/^(TV-)?(Y7?|G|PG|PG-13|14|MA|R|NC-17)(?:\s|–|-|$)/i);
  if (startMatch) {
    const tvPrefix = startMatch[1] || '';
    const code = startMatch[2] || '';
    if (tvPrefix) {
      return `TV-${code.toUpperCase()}`;
    } else {
      return code.toUpperCase();
    }
  }
  
  // If no match at start, try to find the rating code anywhere
  const anywhereMatch = trimmed.match(/(TV-)?(Y7?|G|PG|PG-13|14|MA|R|NC-17)/i);
  if (anywhereMatch) {
    const tvPrefix = anywhereMatch[1] || '';
    const code = anywhereMatch[2] || '';
    if (tvPrefix) {
      return `TV-${code.toUpperCase()}`;
    } else {
      return code.toUpperCase();
    }
  }
  
  return null;
}

