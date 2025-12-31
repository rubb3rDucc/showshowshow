import dotenv from 'dotenv';

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_API_BASE_URL = process.env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  console.warn('⚠️  TMDB_API_KEY not set in environment variables');
}

// Fetch with error handling
async function fetchTMDB(endpoint: string): Promise<any> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  const url = `${TMDB_API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Search for shows and movies
export async function searchTMDB(query: string, page: number = 1, includeAdult: boolean = false): Promise<any> {
  const endpoint = `/search/multi?query=${encodeURIComponent(query)}&page=${page}&include_adult=${includeAdult}`;
  return fetchTMDB(endpoint);
}

// Get TV show details
export async function getShowDetails(tmdbId: number): Promise<any> {
  const endpoint = `/tv/${tmdbId}`;
  return fetchTMDB(endpoint);
}

// Get movie details
export async function getMovieDetails(tmdbId: number): Promise<any> {
  const endpoint = `/movie/${tmdbId}`;
  return fetchTMDB(endpoint);
}

// Get show seasons
export async function getShowSeasons(tmdbId: number): Promise<any[]> {
  const show = await getShowDetails(tmdbId);
  const seasons: any[] = [];

  // Fetch each season
  for (let seasonNum = 0; seasonNum <= show.number_of_seasons; seasonNum++) {
    try {
      const season = await fetchTMDB(`/tv/${tmdbId}/season/${seasonNum}`);
      seasons.push(season);
    } catch (error) {
      // Some seasons might not exist, skip them
      console.warn(`Season ${seasonNum} not found for show ${tmdbId}`);
    }
  }

  return seasons;
}

// Get specific season
export async function getSeason(tmdbId: number, seasonNumber: number): Promise<any> {
  const endpoint = `/tv/${tmdbId}/season/${seasonNumber}`;
  return fetchTMDB(endpoint);
}

// Get content ratings for TV shows
export async function getShowContentRatings(tmdbId: number): Promise<any> {
  const endpoint = `/tv/${tmdbId}/content_ratings`;
  return fetchTMDB(endpoint);
}

// Get release dates (includes certifications) for movies
export async function getMovieReleaseDates(tmdbId: number): Promise<any> {
  const endpoint = `/movie/${tmdbId}/release_dates`;
  return fetchTMDB(endpoint);
}

// Extract US rating from TMDB content ratings
export function extractUSRating(contentRatings: any, contentType: 'show' | 'movie'): string | null {
  if (contentType === 'show') {
    // For TV shows, look for US rating in content_ratings.results
    const usRatings = contentRatings?.results?.find((r: any) => r.iso_3166_1 === 'US');
    if (usRatings?.rating) {
      return usRatings.rating;
    }
    // Fallback to any rating if US not available
    if (contentRatings?.results?.length > 0 && contentRatings.results[0].rating) {
      return contentRatings.results[0].rating;
    }
  } else {
    // For movies, look for US certification in release_dates.results
    const usReleaseDates = contentRatings?.results?.find((r: any) => r.iso_3166_1 === 'US');
    if (usReleaseDates?.release_dates?.length > 0) {
      // Get the most recent certification
      const certifications = usReleaseDates.release_dates
        .map((rd: any) => rd.certification)
        .filter((c: string) => c && c.length > 0);
      if (certifications.length > 0) {
        return certifications[certifications.length - 1]; // Most recent
      }
    }
    // Fallback to any certification if US not available
    for (const country of contentRatings?.results || []) {
      const certifications = country.release_dates
        ?.map((rd: any) => rd.certification)
        .filter((c: string) => c && c.length > 0) || [];
      if (certifications.length > 0) {
        return certifications[certifications.length - 1];
      }
    }
  }
  return null;
}

// Get image URL (TMDB uses relative paths)
export function getImageUrl(path: string | null, size: string = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// Helper to determine content type from search result
export function getContentType(result: any): 'show' | 'movie' {
  return result.media_type === 'tv' ? 'show' : 'movie';
}

// Helper to get default duration
export function getDefaultDuration(content: any, contentType: 'show' | 'movie'): number {
  if (contentType === 'movie') {
    return content.runtime || 120; // Default 2 hours for movies
  }

  // For shows, use first episode runtime or default
  const show = content;
  if (show.episode_run_time && show.episode_run_time.length > 0) {
    return show.episode_run_time[0];
  }

  return 22; // Default 22 minutes for TV shows
}

// Get network details
export async function getNetworkDetails(networkId: number): Promise<any> {
  const endpoint = `/network/${networkId}`;
  return fetchTMDB(endpoint);
}

// Discover shows by network
export async function discoverShowsByNetwork(
  networkId: number, 
  page: number = 1
): Promise<any> {
  const endpoint = `/discover/tv?with_networks=${networkId}&page=${page}&sort_by=popularity.desc`;
  return fetchTMDB(endpoint);
}

// Trending TV shows
export async function getTrendingShows(page: number = 1): Promise<any> {
  const endpoint = `/trending/tv/week?page=${page}`;
  return fetchTMDB(endpoint);
}

// Popular TV shows
export async function getPopularShows(page: number = 1): Promise<any> {
  const endpoint = `/tv/popular?page=${page}`;
  return fetchTMDB(endpoint);
}

