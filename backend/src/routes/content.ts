import { db } from '../db/index.js';
import { searchTMDB, getShowDetails, getMovieDetails, getSeason, getImageUrl, getContentType, getDefaultDuration, getShowContentRatings, getMovieReleaseDates, extractUSRating } from '../lib/tmdb.js';
import { searchJikan, jikanSearchToSearchResult, getAnimeDetails, getAnimeEpisodes, jikanToContentFormat } from '../lib/jikan.js';
import { normalizeRating } from '../lib/rating-utils.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { parseIntWithDefault } from '../lib/utils.js';
import { authenticateClerk } from '../plugins/clerk-auth.js';
import { requireActiveSubscription } from '../plugins/entitlements.js';
import type { FastifyInstance } from 'fastify';

export const contentRoutes = async (fastify: FastifyInstance) => {
  // Search for shows and movies
  // Stricter rate limit to protect external APIs (TMDB, Jikan)
  fastify.get('/api/content/search', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const searchStartTime = Date.now();
    
    const { q, page = '1', type, include_adult = 'false', source = 'tmdb' } = request.query as { 
      q?: string; 
      page?: string; 
      type?: 'tv' | 'movie';
      include_adult?: string;
      source?: 'tmdb' | 'jikan' | 'auto';
    };
    
    if (!q || q.trim().length === 0) {
      throw new ValidationError('Search query is required');
    }

    // Validate type parameter if provided
    if (type && type !== 'tv' && type !== 'movie') {
      throw new ValidationError('Type must be either "tv" or "movie"');
    }

    // Validate source parameter
    if (source && source !== 'tmdb' && source !== 'jikan' && source !== 'auto') {
      throw new ValidationError('Source must be either "tmdb", "jikan", or "auto"');
    }

    const pageNum = parseIntWithDefault(page, 1);
    let results: any[] = [];
    let totalPages = 1;
    let totalResults = 0;
    let currentPage = pageNum;

    // Search Jikan if source is jikan or auto
    if (source === 'jikan' || source === 'auto') {
      try {
        const jikanResults = await searchJikan(q, pageNum);
        const jikanFormatted = jikanResults.results.map((anime: any) => jikanSearchToSearchResult(anime));
        
        if (source === 'jikan') {
          // Only Jikan results
          results = jikanFormatted;
          totalPages = jikanResults.total_pages;
          totalResults = jikanResults.total_results;
          currentPage = jikanResults.page;
        } else {
          // Auto mode: use Jikan results, but could merge with TMDB later
          results = jikanFormatted;
          totalPages = jikanResults.total_pages;
          totalResults = jikanResults.total_results;
          currentPage = jikanResults.page;
        }
      } catch (error) {
        // If Jikan fails and source is auto, fallback to TMDB
        if (source === 'auto') {
          console.warn('Jikan search failed, falling back to TMDB:', error);
          // Track fallback
          const userId = (request as any).user?.userId || 'anonymous';
          const { captureEvent } = await import('../lib/posthog.js');
          captureEvent('content_search_fallback', {
            distinctId: userId,
            properties: {
              query: q.substring(0, 50),
              source: 'jikan',
              fallback_to: 'tmdb',
              error_type: error instanceof Error ? error.message.substring(0, 100) : 'unknown',
            },
          });
          // Continue to TMDB search below
        } else {
          // If source is jikan and it fails, track error
          const userId = (request as any).user?.userId || 'anonymous';
          const { captureEvent } = await import('../lib/posthog.js');
          captureEvent('content_search_failed', {
            distinctId: userId,
            properties: {
              query: q.substring(0, 50),
              source: 'jikan',
              error_type: error instanceof Error ? error.message.substring(0, 100) : 'unknown',
            },
          });
          // Throw error
          throw error;
        }
      }
    }

    // Search TMDB if source is tmdb or auto (and Jikan didn't provide results)
    if (source === 'tmdb' || (source === 'auto' && results.length === 0)) {
      const includeAdult = include_adult === 'true';
      const searchResults = await searchTMDB(q, pageNum, includeAdult);

    // Filter out people/actors and only keep movies and TV shows
    const contentResults = searchResults.results.filter((result: any) => {
      const mediaType = result.media_type || getContentType(result);
      return mediaType === 'tv' || mediaType === 'movie';
    });

    // Transform results to include image URLs and normalize media_type
      const tmdbResults = contentResults.map((result: any) => {
      const mediaType = result.media_type || getContentType(result);
      const normalizedType = mediaType === 'tv' ? 'tv' : 'movie';
      
      return {
        tmdb_id: result.id,
          mal_id: null,
        title: result.name || result.title || 'Unknown',
        overview: result.overview,
        poster_url: getImageUrl(result.poster_path),
        backdrop_url: getImageUrl(result.backdrop_path, 'w780'),
        content_type: normalizedType,
        media_type: normalizedType,
        release_date: result.release_date || result.first_air_date || null,
        vote_average: result.vote_average || 0,
        popularity: result.popularity || 0,
          data_source: 'tmdb',
        rating: null, // TMDB search API doesn't include ratings - only available if cached
      };
    });

      if (source === 'tmdb' || results.length === 0) {
        results = tmdbResults;
        totalPages = searchResults.total_pages;
        totalResults = searchResults.total_results;
        currentPage = searchResults.page;
      }
    }

    // Filter by type if specified
    if (type) {
      results = results.filter((r: any) => r.media_type === type);
    }

    // Check which results are already cached in the database
    // Using a single batch query instead of N+1 queries (40 queries → 1)
    const tmdbIds = results
      .filter((r: any) => r.tmdb_id)
      .map((r: any) => r.tmdb_id);
    const malIds = results
      .filter((r: any) => r.mal_id)
      .map((r: any) => r.mal_id);

    // Single batch query to check all IDs at once
    let cachedContent: Array<{ id: string; tmdb_id: number | null; mal_id: number | null; content_type: string; rating: string | null }> = [];

    if (tmdbIds.length > 0 || malIds.length > 0) {
      cachedContent = await db
        .selectFrom('content')
        .select(['id', 'tmdb_id', 'mal_id', 'content_type', 'rating'])
        .where((eb) => {
          const conditions = [];
          if (tmdbIds.length > 0) {
            conditions.push(eb('tmdb_id', 'in', tmdbIds));
          }
          if (malIds.length > 0) {
            conditions.push(eb('mal_id', 'in', malIds));
          }
          return eb.or(conditions);
        })
        .execute();
    }

    // Build lookup maps for O(1) access
    const cacheByTmdbId = new Map(
      cachedContent.filter(c => c.tmdb_id).map(c => [c.tmdb_id, c])
    );
    const cacheByMalId = new Map(
      cachedContent.filter(c => c.mal_id).map(c => [c.mal_id, c])
    );

    // Map results with cache status using the lookup maps
    const resultsWithCacheStatus = results.map((result: any) => {
      // Check by tmdb_id first, then mal_id
      const cached = cacheByTmdbId.get(result.tmdb_id) || cacheByMalId.get(result.mal_id) || null;

      // Use cached rating if available, otherwise use result rating
      const rating = normalizeRating(cached?.rating || result.rating || null);

      return {
        ...result,
        rating: rating,
        is_cached: !!cached,
        cached_id: cached?.id || null,
        cached_type: cached?.content_type || null,
      };
    });

    const searchTime = Date.now() - searchStartTime;

    // Track search event (only for authenticated users, or track anonymously)
    const userId = (request as any).user?.userId || 'anonymous';
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('content_searched', {
      distinctId: userId,
      properties: {
        query: q.substring(0, 50), // Truncate long queries
        source: source || 'tmdb',
        result_count: resultsWithCacheStatus.length,
        total_results: totalResults,
        page: currentPage,
        search_time_ms: searchTime,
        type_filter: type || null,
      },
    });

    return reply.send({
      results: resultsWithCacheStatus,
      page: currentPage,
      total_pages: totalPages,
      total_results: resultsWithCacheStatus.length, // Use actual filtered count
    });
  });

  // Check if content is already cached (without caching it)
  fastify.get('/api/content/:tmdbId/check', async (request, reply) => {
    const { tmdbId } = request.params as { tmdbId: string };
    const { mal_id } = request.query as { mal_id?: string };
    const tmdbIdNum = parseInt(tmdbId, 10);

    let cached = null;

    // Check by tmdb_id if provided
    if (!isNaN(tmdbIdNum)) {
      cached = await db
      .selectFrom('content')
      .selectAll()
      .where('tmdb_id', '=', tmdbIdNum)
      .executeTakeFirst();
    }

    // Check by mal_id if not found and mal_id provided
    if (!cached && mal_id) {
      const malIdNum = parseInt(mal_id, 10);
      if (!isNaN(malIdNum)) {
        cached = await db
          .selectFrom('content')
          .selectAll()
          .where('mal_id', '=', malIdNum)
          .executeTakeFirst();
      }
    }

    return reply.send({
      tmdb_id: isNaN(tmdbIdNum) ? null : tmdbIdNum,
      mal_id: mal_id ? parseInt(mal_id, 10) : null,
      is_cached: !!cached,
      content: cached || null,
    });
  });

  // Get or cache Jikan content by MAL ID
  fastify.get('/api/content/jikan/:malId', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const { malId } = request.params as { malId: string };
    const malIdNum = parseInt(malId, 10);

    if (isNaN(malIdNum)) {
      throw new ValidationError('Invalid MAL ID');
    }

    // Check if already in database
    const existing = await db
      .selectFrom('content')
      .selectAll()
      .where('mal_id', '=', malIdNum)
      .executeTakeFirst();

    if (existing) {
      return reply.send(existing);
    }

    // Fetch from Jikan
    const jikanAnime = await getAnimeDetails(malIdNum);
    const contentData = jikanToContentFormat(jikanAnime);

    // Save to database
    const saved = await db
      .insertInto('content')
      .values({
        id: crypto.randomUUID(),
        tmdb_id: null, // Jikan content doesn't have TMDB ID
        mal_id: contentData.mal_id,
        data_source: 'jikan',
        content_type: contentData.content_type, // 'show' or 'movie'
        title: contentData.title,
        title_english: contentData.title_english,
        title_japanese: contentData.title_japanese,
        overview: contentData.overview,
        poster_url: contentData.poster_url,
        backdrop_url: contentData.backdrop_url,
        release_date: contentData.release_date, // For movies
        first_air_date: contentData.first_air_date, // For shows
        default_duration: contentData.default_duration,
        number_of_episodes: contentData.number_of_episodes,
        number_of_seasons: contentData.number_of_seasons,
        status: contentData.status,
        rating: contentData.rating,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Episodes will be fetched on-demand when user requests them via /api/content/by-id/:contentId/episodes
    return reply.send(saved);
  });

  // Get show or movie details (and cache in database)
  fastify.get('/api/content/:tmdbId', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const { tmdbId } = request.params as { tmdbId: string };
    const { type } = request.query as { type?: 'tv' | 'movie' };
    const tmdbIdNum = parseInt(tmdbId, 10);

    if (isNaN(tmdbIdNum)) {
      throw new ValidationError('Invalid TMDB ID');
    }

    // Validate type parameter if provided
    if (type && type !== 'tv' && type !== 'movie') {
      throw new ValidationError('Type must be either "tv" or "movie"');
    }

    // Check if already in database
    const existing = await db
      .selectFrom('content')
      .selectAll()
      .where('tmdb_id', '=', tmdbIdNum)
      .executeTakeFirst();

    // If type is specified and existing content doesn't match, delete and re-fetch
    if (existing && type) {
      const existingType = existing.content_type === 'show' ? 'series' : 'movie';
      if (existingType !== type) {
        console.log(`Content ${tmdbIdNum} exists as ${existingType} but ${type} requested. Deleting and re-fetching...`);
        
        // Delete related data first
        await db.deleteFrom('episodes').where('content_id', '=', existing.id).execute();
        await db.deleteFrom('queue').where('content_id', '=', existing.id).execute();
        await db.deleteFrom('schedule').where('content_id', '=', existing.id).execute();
        await db.deleteFrom('content').where('id', '=', existing.id).execute();
        
        // Continue to fetch new content below
      } else {
        // Type matches, return existing
        return reply.send(existing);
      }
    } else if (existing) {
      // No type specified and content exists, return it
      // Track content details viewed
      const userId = (request as any).user?.userId || 'anonymous';
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('content_details_viewed', {
        distinctId: userId,
        properties: {
          content_id: existing.id,
          content_type: existing.content_type,
          source: existing.data_source || 'tmdb',
        },
      });

      return reply.send(existing);
    }

    // Fetch from TMDB based on type parameter
    let content: any;

    if (type === 'tv') {
      // Force TV show lookup
      const show = await getShowDetails(tmdbIdNum);
      // Fetch content ratings
      let rating: string | null = null;
      try {
        const contentRatings = await getShowContentRatings(tmdbIdNum);
        rating = extractUSRating(contentRatings, 'show');
      } catch (error) {
        console.warn(`Failed to fetch content ratings for show ${tmdbIdNum}:`, error);
      }
      
      content = {
        tmdb_id: show.id,
        data_source: 'tmdb',
        content_type: 'show',
        title: show.name,
        overview: show.overview,
        poster_url: getImageUrl(show.poster_path),
        backdrop_url: getImageUrl(show.backdrop_path, 'w780'),
        first_air_date: show.first_air_date ? new Date(show.first_air_date) : null,
        last_air_date: show.last_air_date ? new Date(show.last_air_date) : null,
        default_duration: getDefaultDuration(show, 'show'),
        number_of_seasons: show.number_of_seasons,
        number_of_episodes: show.number_of_episodes,
        status: show.status,
        rating: normalizeRating(rating),
      };
    } else if (type === 'movie') {
      // Force movie lookup
      const movie = await getMovieDetails(tmdbIdNum);
      // Fetch release dates (includes certifications)
      let rating: string | null = null;
      try {
        const releaseDates = await getMovieReleaseDates(tmdbIdNum);
        rating = extractUSRating(releaseDates, 'movie');
      } catch (error) {
        console.warn(`Failed to fetch release dates for movie ${tmdbIdNum}:`, error);
      }
      
      content = {
        tmdb_id: movie.id,
        data_source: 'tmdb',
        content_type: 'movie',
        title: movie.title,
        overview: movie.overview,
        poster_url: getImageUrl(movie.poster_path),
        backdrop_url: getImageUrl(movie.backdrop_path, 'w780'),
        release_date: movie.release_date ? new Date(movie.release_date) : null,
        default_duration: getDefaultDuration(movie, 'movie'),
        number_of_seasons: null,
        number_of_episodes: null,
        status: null,
        rating: normalizeRating(rating),
      };
    } else {
      // No type specified - try movie first, then show
      try {
        const movie = await getMovieDetails(tmdbIdNum);
        // Fetch release dates (includes certifications)
        let rating: string | null = null;
        try {
          const releaseDates = await getMovieReleaseDates(tmdbIdNum);
          rating = extractUSRating(releaseDates, 'movie');
        } catch (error) {
          console.warn(`Failed to fetch release dates for movie ${tmdbIdNum}:`, error);
        }
        
        content = {
          tmdb_id: movie.id,
          content_type: 'movie',
          title: movie.title,
          overview: movie.overview,
          poster_url: getImageUrl(movie.poster_path),
          backdrop_url: getImageUrl(movie.backdrop_path, 'w780'),
          release_date: movie.release_date ? new Date(movie.release_date) : null,
          default_duration: getDefaultDuration(movie, 'movie'),
          number_of_seasons: null,
          number_of_episodes: null,
          status: null,
          rating: normalizeRating(rating),
        };
      } catch (error) {
        // Not a movie, try show
        try {
          const show = await getShowDetails(tmdbIdNum);
          // Fetch content ratings
          let rating: string | null = null;
          try {
            const contentRatings = await getShowContentRatings(tmdbIdNum);
            rating = extractUSRating(contentRatings, 'show');
          } catch (error) {
            console.warn(`Failed to fetch content ratings for show ${tmdbIdNum}:`, error);
          }
          
          content = {
            tmdb_id: show.id,
            content_type: 'show',
            title: show.name,
            overview: show.overview,
            poster_url: getImageUrl(show.poster_path),
            backdrop_url: getImageUrl(show.backdrop_path, 'w780'),
            first_air_date: show.first_air_date ? new Date(show.first_air_date) : null,
            last_air_date: show.last_air_date ? new Date(show.last_air_date) : null,
            default_duration: getDefaultDuration(show, 'show'),
            number_of_seasons: show.number_of_seasons,
            number_of_episodes: show.number_of_episodes,
            status: show.status,
            rating: normalizeRating(rating),
          };
        } catch (showError) {
          throw new NotFoundError('Content not found in TMDB');
        }
      }
    }

    // Save to database
    const saved = await db
      .insertInto('content')
      .values({
        id: crypto.randomUUID(),
        ...content,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Store network associations for TV shows from TMDB
    // Only associate with networks that already exist in our database (user-curated)
    if (saved.content_type === 'show' && saved.data_source === 'tmdb' && saved.tmdb_id) {
      try {
        const showDetails = await getShowDetails(saved.tmdb_id);

        if (showDetails.networks && showDetails.networks.length > 0) {
          for (const network of showDetails.networks) {
            // Check if network exists in our database (don't auto-create)
            const dbNetwork = await db
              .selectFrom('networks')
              .select('id')
              .where('tmdb_network_id', '=', network.id)
              .executeTakeFirst();

            // Only create association if the network already exists
            if (dbNetwork) {
              await db
                .insertInto('content_networks')
                .values({
                  id: crypto.randomUUID(),
                  content_id: saved.id,
                  network_id: dbNetwork.id,
                  is_original: false,
                  created_at: new Date(),
                })
                .onConflict((oc) => oc.columns(['content_id', 'network_id']).doNothing())
                .execute();
            }
          }
        }
      } catch (error) {
        // Don't fail the request if network association fails
        console.warn(`Failed to store network associations for content ${saved.id}:`, error);
      }
    }

    // Track content details viewed (newly fetched)
    const userId = (request as any).user?.userId || 'anonymous';
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('content_details_viewed', {
      distinctId: userId,
      properties: {
        content_id: saved.id,
        content_type: saved.content_type,
        source: saved.data_source || 'tmdb',
      },
    });

    return reply.send(saved);
  });

  // Get episodes for a show by content_id (supports both TMDB and Jikan)
  fastify.get('/api/content/by-id/:contentId/episodes', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const { contentId } = request.params as { contentId: string };
    const { season } = request.query as { season?: string };

    // Get content from database
    const content = await db
      .selectFrom('content')
      .selectAll()
      .where('id', '=', contentId)
      .executeTakeFirst();

    if (!content) {
      throw new NotFoundError('Content not found');
    }

    if (content.content_type !== 'show') {
      throw new ValidationError('Episodes are only available for TV shows');
    }

    // If specific season requested
    if (season) {
      const seasonNum = parseInt(season, 10);
      if (isNaN(seasonNum)) {
        throw new ValidationError('Invalid season number');
      }

      // Check if episodes already in database
      const existingEpisodes = await db
        .selectFrom('episodes')
        .selectAll()
        .where('content_id', '=', content.id)
        .where('season', '=', seasonNum)
        .execute();

      if (existingEpisodes.length > 0) {
        return reply.send(existingEpisodes);
      }

      // Fetch episodes based on data source
      if (content.data_source === 'jikan' && content.mal_id) {
        // Fetch from Jikan (Jikan doesn't have seasons, all episodes are in one list)
        // For season 1, fetch all episodes
        if (seasonNum === 1) {
          const allEpisodes: any[] = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const jikanEpisodes = await getAnimeEpisodes(content.mal_id, page);
            const episodes = jikanEpisodes.episodes || [];
            
            for (const ep of episodes) {
              const episodeNum = ep.episode || allEpisodes.length + 1;
              const saved = await db
                .insertInto('episodes')
                .values({
                  id: crypto.randomUUID(),
                  content_id: content.id,
                  season: 1, // Jikan doesn't have seasons
                  episode_number: episodeNum,
                  title: ep.title || `Episode ${episodeNum}`,
                  overview: null, // Jikan API doesn't provide episode descriptions
                  duration: content.default_duration,
                  air_date: ep.aired ? new Date(ep.aired) : null,
                  still_url: ep.images?.jpg?.image_url || null,
                  created_at: new Date(),
                })
                .returningAll()
                .executeTakeFirstOrThrow();
              allEpisodes.push(saved);
            }

            hasMore = page < (jikanEpisodes.pagination?.last_visible_page || 1);
            page++;
          }

          return reply.send(allEpisodes);
        } else {
          // Jikan doesn't have multiple seasons
          return reply.send([]);
        }
      } else if (content.tmdb_id) {
        // Fetch from TMDB
        const tmdbSeason = await getSeason(content.tmdb_id, seasonNum);

        // Save episodes to database
        const episodes = await Promise.all(
          tmdbSeason.episodes.map(async (ep: any) => {
            return db
              .insertInto('episodes')
              .values({
                id: crypto.randomUUID(),
                content_id: content.id,
                season: ep.season_number,
                episode_number: ep.episode_number,
                title: ep.name,
                overview: ep.overview,
                duration: ep.runtime || content.default_duration,
                air_date: ep.air_date ? new Date(ep.air_date) : null,
                still_url: getImageUrl(ep.still_path),
                created_at: new Date(),
              })
              .returningAll()
              .executeTakeFirstOrThrow();
          })
        );

        return reply.send(episodes);
      } else {
        throw new ValidationError('Content has no valid source ID');
      }
    }

    // Get all episodes for all seasons
    const existingEpisodes = await db
      .selectFrom('episodes')
      .selectAll()
      .where('content_id', '=', content.id)
      .orderBy('season', 'asc')
      .orderBy('episode_number', 'asc')
      .execute();

    if (existingEpisodes.length > 0) {
      return reply.send(existingEpisodes);
    }

    // Fetch episodes based on data source
    if (content.data_source === 'jikan' && content.mal_id) {
      // Fetch all episodes from Jikan
      const allEpisodes: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const jikanEpisodes = await getAnimeEpisodes(content.mal_id, page);
        const episodes = jikanEpisodes.episodes || [];
        
        for (const ep of episodes) {
          const episodeNum = ep.episode || allEpisodes.length + 1;
          const saved = await db
            .insertInto('episodes')
            .values({
              id: crypto.randomUUID(),
              content_id: content.id,
              season: 1, // Jikan doesn't have seasons
              episode_number: episodeNum,
              title: ep.title || `Episode ${episodeNum}`,
              overview: null, // Jikan API doesn't provide episode descriptions
              duration: content.default_duration,
              air_date: ep.aired ? new Date(ep.aired) : null,
              still_url: ep.images?.jpg?.image_url || null,
              created_at: new Date(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
          allEpisodes.push(saved);
        }

        hasMore = page < (jikanEpisodes.pagination?.last_visible_page || 1);
        page++;
      }

      return reply.send(allEpisodes);
    } else if (content.tmdb_id) {
      // Fetch all seasons from TMDB
      const show = await getShowDetails(content.tmdb_id);
      const allEpisodes: any[] = [];

      for (let seasonNum = 1; seasonNum <= (show.number_of_seasons || 0); seasonNum++) {
        try {
          const tmdbSeason = await getSeason(content.tmdb_id, seasonNum);
          for (const ep of tmdbSeason.episodes) {
            const saved = await db
              .insertInto('episodes')
              .values({
                id: crypto.randomUUID(),
                content_id: content.id,
                season: ep.season_number,
                episode_number: ep.episode_number,
                title: ep.name,
                overview: ep.overview,
                duration: ep.runtime || content.default_duration,
                air_date: ep.air_date ? new Date(ep.air_date) : null,
                still_url: getImageUrl(ep.still_path),
                created_at: new Date(),
              })
              .returningAll()
              .executeTakeFirstOrThrow();
            allEpisodes.push(saved);
          }
        } catch (error) {
          console.warn(`Failed to fetch season ${seasonNum} for show ${content.tmdb_id}`);
        }
      }

      return reply.send(allEpisodes);
    } else {
      throw new ValidationError('Content has no valid source ID');
    }
  });

  // Get episodes for a show by TMDB ID (legacy endpoint, kept for backward compatibility)
  fastify.get('/api/content/:tmdbId/episodes', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const { tmdbId } = request.params as { tmdbId: string };
    const { season } = request.query as { season?: string };
    const tmdbIdNum = parseInt(tmdbId, 10);

    if (isNaN(tmdbIdNum)) {
      throw new ValidationError('Invalid TMDB ID');
    }

    // Get or create content in database
    let content = await db
      .selectFrom('content')
      .selectAll()
      .where('tmdb_id', '=', tmdbIdNum)
      .executeTakeFirst();

    if (!content) {
      // Fetch and save content first
      const show = await getShowDetails(tmdbIdNum);
      // Fetch content ratings
      let rating: string | null = null;
      try {
        const contentRatings = await getShowContentRatings(tmdbIdNum);
        rating = extractUSRating(contentRatings, 'show');
      } catch (error) {
        console.warn(`Failed to fetch content ratings for show ${tmdbIdNum}:`, error);
      }
      
      content = await db
        .insertInto('content')
        .values({
          id: crypto.randomUUID(),
          tmdb_id: show.id,
          data_source: 'tmdb',
          content_type: 'show',
          title: show.name,
          overview: show.overview,
          poster_url: getImageUrl(show.poster_path),
          backdrop_url: getImageUrl(show.backdrop_path, 'w780'),
          first_air_date: show.first_air_date ? new Date(show.first_air_date) : null,
          last_air_date: show.last_air_date ? new Date(show.last_air_date) : null,
          default_duration: getDefaultDuration(show, 'show'),
          number_of_seasons: show.number_of_seasons,
          number_of_episodes: show.number_of_episodes,
          status: show.status,
          rating: normalizeRating(rating),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    if (content.content_type !== 'show') {
      throw new ValidationError('Episodes are only available for TV shows');
    }

    // Redirect to content_id endpoint
    return reply.redirect(`/api/content/by-id/${content.id}/episodes${season ? `?season=${season}` : ''}`);
  });

  // Refresh/update existing content (re-fetch from API and update database)
  fastify.put('/api/content/:contentId/refresh', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const { contentId } = request.params as { contentId: string };

    // Get existing content
    const existing = await db
      .selectFrom('content')
      .selectAll()
      .where('id', '=', contentId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Content not found');
    }

    let updatedContent: any;

    if (existing.data_source === 'jikan' && existing.mal_id) {
      // Re-fetch from Jikan
      const jikanAnime = await getAnimeDetails(existing.mal_id);
      const contentData = jikanToContentFormat(jikanAnime);

      updatedContent = await db
        .updateTable('content')
        .set({
          title: contentData.title,
          title_english: contentData.title_english,
          title_japanese: contentData.title_japanese,
          overview: contentData.overview,
          poster_url: contentData.poster_url,
          backdrop_url: contentData.backdrop_url,
          release_date: contentData.release_date,
          first_air_date: contentData.first_air_date,
          default_duration: contentData.default_duration,
          number_of_episodes: contentData.number_of_episodes,
          number_of_seasons: contentData.number_of_seasons,
          status: contentData.status,
          rating: contentData.rating,
          updated_at: new Date(),
        })
        .where('id', '=', contentId)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else if (existing.tmdb_id) {
      // Re-fetch from TMDB
      let rating: string | null = null;
      
      if (existing.content_type === 'show') {
        const show = await getShowDetails(existing.tmdb_id);
        try {
          const contentRatings = await getShowContentRatings(existing.tmdb_id);
          rating = extractUSRating(contentRatings, 'show');
        } catch (error) {
          console.warn(`Failed to fetch content ratings for show ${existing.tmdb_id}:`, error);
        }

        updatedContent = await db
          .updateTable('content')
          .set({
            title: show.name,
            overview: show.overview,
            poster_url: getImageUrl(show.poster_path),
            backdrop_url: getImageUrl(show.backdrop_path, 'w780'),
            first_air_date: show.first_air_date ? new Date(show.first_air_date) : null,
            last_air_date: show.last_air_date ? new Date(show.last_air_date) : null,
            default_duration: getDefaultDuration(show, 'show'),
            number_of_seasons: show.number_of_seasons,
            number_of_episodes: show.number_of_episodes,
            status: show.status,
            rating: normalizeRating(rating),
            updated_at: new Date(),
          })
          .where('id', '=', contentId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        const movie = await getMovieDetails(existing.tmdb_id);
        try {
          const releaseDates = await getMovieReleaseDates(existing.tmdb_id);
          rating = extractUSRating(releaseDates, 'movie');
        } catch (error) {
          console.warn(`Failed to fetch release dates for movie ${existing.tmdb_id}:`, error);
        }

        updatedContent = await db
          .updateTable('content')
          .set({
            title: movie.title,
            overview: movie.overview,
            poster_url: getImageUrl(movie.poster_path),
            backdrop_url: getImageUrl(movie.backdrop_path, 'w780'),
            release_date: movie.release_date ? new Date(movie.release_date) : null,
            default_duration: getDefaultDuration(movie, 'movie'),
            rating: normalizeRating(rating),
            updated_at: new Date(),
          })
          .where('id', '=', contentId)
          .returningAll()
          .executeTakeFirstOrThrow();
      }
    } else {
      throw new ValidationError('Content has no valid source ID to refresh from');
    }

    return reply.send(updatedContent);
  });

  // Get user's library (all content they've added)
  fastify.get('/api/content/library', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;

    // Get content from queue, schedule, or watch history
    const libraryContent = await db
      .selectFrom('content')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb.exists(
            eb
              .selectFrom('queue')
              .select('id')
              .whereRef('queue.content_id', '=', 'content.id')
              .where('queue.user_id', '=', userId)
          ),
          eb.exists(
            eb
              .selectFrom('schedule')
              .select('id')
              .whereRef('schedule.content_id', '=', 'content.id')
              .where('schedule.user_id', '=', userId)
          ),
          eb.exists(
            eb
              .selectFrom('watch_history')
              .select('id')
              .whereRef('watch_history.content_id', '=', 'content.id')
              .where('watch_history.user_id', '=', userId)
          ),
        ])
      )
      .orderBy('created_at', 'desc')
      .execute();

    return reply.send(libraryContent);
  });
};

