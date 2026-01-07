import dotenv from 'dotenv';

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_API_BASE_URL = process.env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_TIMEOUT_MS = parseInt(process.env.TMDB_TIMEOUT_MS || '10000', 10); // 10 second default

if (!TMDB_API_KEY) {
  console.warn('⚠️  TMDB_API_KEY not set in environment variables');
}

// Fetch with timeout and error handling
async function fetchTMDB(endpoint: string): Promise<any> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  const url = `${TMDB_API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`TMDB API request timed out after ${TMDB_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
  if (!path || path.trim() === '') return null;
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
// If isProvider is true, only check providers list (don't try network endpoint)
export async function getNetworkDetails(networkId: number, isProvider: boolean = false): Promise<any> {
  // If explicitly marked as provider, skip network endpoint
  if (isProvider) {
    const providersEndpoint = `/watch/providers/tv?watch_region=US`;
    const providers = await fetchTMDB(providersEndpoint);
    
    if (providers.results) {
      const provider = providers.results.find((p: any) => p.provider_id === networkId);
      if (provider) {
        // Format provider data to match network structure
        return {
          id: provider.provider_id,
          name: provider.provider_name,
          logo_path: provider.logo_path,
          origin_country: 'US',
          headquarters: '',
          homepage: '',
        };
      }
    }
    throw new Error(`Provider ${networkId} not found`);
  }
  
  // Otherwise, try as a traditional TV network first
  try {
    const endpoint = `/network/${networkId}`;
    const result = await fetchTMDB(endpoint);
    if (result && result.id) {
      return result;
    }
  } catch (error) {
    // If 404, it might be a provider ID instead
    console.log(`Network ${networkId} not found, trying as provider...`);
  }
  
  // If network endpoint fails, try getting it from the providers list
  try {
    const providersEndpoint = `/watch/providers/tv?watch_region=US`;
    const providers = await fetchTMDB(providersEndpoint);
    
    if (providers.results) {
      const provider = providers.results.find((p: any) => p.provider_id === networkId);
      if (provider) {
        // Format provider data to match network structure
        return {
          id: provider.provider_id,
          name: provider.provider_name,
          logo_path: provider.logo_path,
          origin_country: 'US',
          headquarters: '',
          homepage: '',
        };
      }
    }
  } catch (error) {
    console.error(`Failed to fetch provider ${networkId}:`, error);
  }
  
  throw new Error(`Network/Provider ${networkId} not found`);
}

// Search for networks
// Note: TMDB doesn't have a direct network search endpoint, so we search for companies
// and filter to only those that are actually TV networks
export async function searchNetworks(query: string, page: number = 1): Promise<any> {
  const endpoint = `/search/company?query=${encodeURIComponent(query)}&page=${page}`;
  return fetchTMDB(endpoint);
}

// Get list of available networks (alternative approach)
export async function getAvailableNetworks(): Promise<any> {
  // TMDB has a configuration endpoint that lists all available networks
  const endpoint = `/configuration/tv`;
  return fetchTMDB(endpoint);
}

// Discover shows by network
// If isProvider is true, only use with_watch_providers parameter
export async function discoverShowsByNetwork(
  networkId: number, 
  page: number = 1,
  isProvider: boolean = false
): Promise<any> {
  // If explicitly marked as provider, ONLY use with_watch_providers
  if (isProvider) {
    try {
      const endpoint = `/discover/tv?with_watch_providers=${networkId}&watch_region=US&page=${page}&sort_by=popularity.desc`;
      return await fetchTMDB(endpoint);
    } catch (error) {
      console.error('Error fetching provider content:', error);
      return {
        page: 1,
        results: [],
        total_pages: 0,
        total_results: 0,
      };
    }
  }
  
  // Otherwise, try with_networks first (for traditional TV networks)
  try {
    const endpoint = `/discover/tv?with_networks=${networkId}&page=${page}&sort_by=popularity.desc`;
    const result = await fetchTMDB(endpoint);
    
    // If we got results, return them
    if (result.results && result.results.length > 0) {
      return result;
    }
  } catch (error) {
    console.error('Error fetching with networks:', error);
  }
  
  // If no results, try with_watch_providers as fallback (for streaming services like Tubi, Mubi)
  try {
    const endpoint = `/discover/tv?with_watch_providers=${networkId}&watch_region=US&page=${page}&sort_by=popularity.desc`;
    return await fetchTMDB(endpoint);
  } catch (error) {
    console.error('Error fetching with providers:', error);
    // Return empty results if both fail
    return {
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    };
  }
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

// Get TV show credits (cast & crew)
export async function getShowCredits(tmdbId: number): Promise<any> {
  const endpoint = `/tv/${tmdbId}/credits`;
  return fetchTMDB(endpoint);
}

// Get movie credits (cast & crew)
export async function getMovieCredits(tmdbId: number): Promise<any> {
  const endpoint = `/movie/${tmdbId}/credits`;
  return fetchTMDB(endpoint);
}

// Get person details
export async function getPersonDetails(personId: number): Promise<any> {
  const endpoint = `/person/${personId}`;
  return fetchTMDB(endpoint);
}

// Get person's combined credits (movies + TV)
export async function getPersonCombinedCredits(personId: number): Promise<any> {
  const endpoint = `/person/${personId}/combined_credits`;
  return fetchTMDB(endpoint);
}

// Search for people
export async function searchPeople(query: string, page: number = 1): Promise<any> {
  const endpoint = `/search/person?query=${encodeURIComponent(query)}&page=${page}`;
  return fetchTMDB(endpoint);
}

