import { db } from '../db/index.js';
import { searchTMDB, getShowDetails, getMovieDetails, getSeason, getImageUrl, getContentType, getDefaultDuration } from '../lib/tmdb.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { authenticate } from '../plugins/auth.js';
import type { FastifyInstance } from 'fastify';

export const contentRoutes = async (fastify: FastifyInstance) => {
  // Search for shows and movies
  fastify.get('/api/content/search', async (request, reply) => {
    const { q, page = '1' } = request.query as { q?: string; page?: string };
    
    if (!q || q.trim().length === 0) {
      throw new ValidationError('Search query is required');
    }

    const pageNum = parseInt(page, 10) || 1;
    const searchResults = await searchTMDB(q, pageNum);

    // Transform results to include image URLs
    const results = searchResults.results.map((result: any) => ({
      tmdb_id: result.id,
      title: result.name || result.title || 'Unknown',
      overview: result.overview,
      poster_url: getImageUrl(result.poster_path),
      backdrop_url: getImageUrl(result.backdrop_path, 'w780'),
      content_type: getContentType(result),
      release_date: result.release_date || result.first_air_date || null,
      media_type: result.media_type,
    }));

    return reply.send({
      results,
      page: searchResults.page,
      total_pages: searchResults.total_pages,
      total_results: searchResults.total_results,
    });
  });

  // Get show or movie details (and cache in database)
  fastify.get('/api/content/:tmdbId', async (request, reply) => {
    const { tmdbId } = request.params as { tmdbId: string };
    const tmdbIdNum = parseInt(tmdbId, 10);

    if (isNaN(tmdbIdNum)) {
      throw new ValidationError('Invalid TMDB ID');
    }

    // Check if already in database
    const existing = await db
      .selectFrom('content')
      .selectAll()
      .where('tmdb_id', '=', tmdbIdNum)
      .executeTakeFirst();

    if (existing) {
      // If content exists but might be wrong type, try to refresh
      // For now, just return existing - can add ?refresh=true param later
      return reply.send(existing);
    }

    // Fetch from TMDB - try movie first, then show (movies are more common)
    let content: any;
    let contentType = 'movie';

    try {
      const movie = await getMovieDetails(tmdbIdNum);
      contentType = 'movie';
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
      };
    } catch (error) {
      // Not a movie, try show
      try {
        const show = await getShowDetails(tmdbIdNum);
        contentType = 'show';
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
        };
      } catch (showError) {
        throw new NotFoundError('Content not found in TMDB');
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

    return reply.send(saved);
  });

  // Get episodes for a show (and cache in database)
  fastify.get('/api/content/:tmdbId/episodes', async (request, reply) => {
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
      content = await db
        .insertInto('content')
        .values({
          id: crypto.randomUUID(),
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
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
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

      // Fetch from TMDB
      const tmdbSeason = await getSeason(tmdbIdNum, seasonNum);

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

    // Fetch all seasons from TMDB
    const show = await getShowDetails(tmdbIdNum);
    const allEpisodes: any[] = [];

    for (let seasonNum = 1; seasonNum <= show.number_of_seasons; seasonNum++) {
      try {
        const tmdbSeason = await getSeason(tmdbIdNum, seasonNum);
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
        console.warn(`Failed to fetch season ${seasonNum} for show ${tmdbIdNum}`);
      }
    }

    return reply.send(allEpisodes);
  });

  // Get user's library (all content they've added)
  fastify.get('/api/content/library', { preHandler: authenticate }, async (request, reply) => {
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

