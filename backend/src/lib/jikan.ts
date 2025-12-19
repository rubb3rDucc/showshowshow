/**
 * Jikan API Client
 * Unofficial MyAnimeList API wrapper
 * Documentation: https://docs.api.jikan.moe/
 * Rate limit: 3 requests/second
 */

const JIKAN_API_BASE_URL = 'https://api.jikan.moe/v4';

// Rate limiting: stagger requests to respect 3 req/sec limit
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 350; // 350ms between requests (slightly more than 3/sec)

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Jikan API rate limit exceeded. Please wait a moment.');
    }
    if (response.status === 404) {
      throw new Error('Anime not found in Jikan API');
    }
    throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

// Search anime
export async function searchJikan(query: string, page: number = 1): Promise<any> {
  const url = `${JIKAN_API_BASE_URL}/anime?q=${encodeURIComponent(query)}&page=${page}&limit=25`;
  const response = await rateLimitedFetch(url);
  const data = await response.json();
  
  return {
    results: data.data || [],
    page: data.pagination?.current_page || page,
    total_pages: data.pagination?.last_visible_page || 1,
    total_results: data.pagination?.items?.total || 0,
  };
}

// Get anime details by MAL ID
export async function getAnimeDetails(malId: number): Promise<any> {
  const url = `${JIKAN_API_BASE_URL}/anime/${malId}/full`;
  const response = await rateLimitedFetch(url);
  const data = await response.json();
  
  return data.data;
}

// Get anime episodes by MAL ID
export async function getAnimeEpisodes(malId: number, page: number = 1): Promise<any> {
  const url = `${JIKAN_API_BASE_URL}/anime/${malId}/episodes?page=${page}`;
  const response = await rateLimitedFetch(url);
  const data = await response.json();
  
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
  let defaultDuration = isMovie ? 120 : 24; // Default 120 min for movies, 24 min for shows
  if (jikanAnime.duration) {
    if (isMovie) {
      // For movies, parse total duration (e.g., "120 min")
      const durationMatch = jikanAnime.duration.match(/(\d+)\s*min/);
      if (durationMatch) {
        defaultDuration = parseInt(durationMatch[1], 10);
      }
    } else {
      // For shows, parse per-episode duration (e.g., "24 min per ep")
      const durationMatch = jikanAnime.duration.match(/(\d+)\s*min/);
      if (durationMatch) {
        defaultDuration = parseInt(durationMatch[1], 10);
      }
    }
  }

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

