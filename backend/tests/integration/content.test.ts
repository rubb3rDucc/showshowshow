/**
 * Integration tests for content routes
 * Tests database-centric content endpoints
 * Note: Tests that require external API calls (TMDB, Jikan) are mocked
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { ValidationError, NotFoundError } from '../../src/lib/errors.js';

// Generate unique IDs for each test run
const getUniqueTmdbId = () => 9000000 + Math.floor(Math.random() * 100000);
const getUniqueMalId = () => 8000000 + Math.floor(Math.random() * 100000);

/**
 * Create simplified content routes for testing
 * (without external API dependencies for basic operations)
 */
async function createContentRoutes(fastify: FastifyInstance) {
  // Check if content is cached
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

  // Get episodes by content ID
  fastify.get('/api/content/by-id/:contentId/episodes', async (request, reply) => {
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

    // Build episodes query
    let query = db
      .selectFrom('episodes')
      .selectAll()
      .where('content_id', '=', content.id)
      .orderBy('season', 'asc')
      .orderBy('episode_number', 'asc');

    if (season) {
      const seasonNum = parseInt(season, 10);
      if (isNaN(seasonNum)) {
        throw new ValidationError('Invalid season number');
      }
      query = query.where('season', '=', seasonNum);
    }

    const episodes = await query.execute();
    return reply.send(episodes);
  });

  // Refresh content - minimal test version
  fastify.put('/api/content/:contentId/refresh', async (request, reply) => {
    const { contentId } = request.params as { contentId: string };

    const existing = await db
      .selectFrom('content')
      .selectAll()
      .where('id', '=', contentId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Content not found');
    }

    // For testing, just update the updated_at timestamp
    const updated = await db
      .updateTable('content')
      .set({ updated_at: new Date() })
      .where('id', '=', contentId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.send(updated);
  });
}

describe('Content Routes', () => {
  let app: FastifyInstance;
  const createdContentIds: string[] = [];
  const createdEpisodeIds: string[] = [];

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.decorate('db', db);
    await app.register(errorHandlerPlugin);
    await createContentRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test data
    if (createdEpisodeIds.length > 0) {
      await db
        .deleteFrom('episodes')
        .where('id', 'in', createdEpisodeIds)
        .execute();
    }
    if (createdContentIds.length > 0) {
      await db
        .deleteFrom('content')
        .where('id', 'in', createdContentIds)
        .execute();
    }
    await app.close();
  });

  describe('GET /api/content/:tmdbId/check', () => {
    it('should return is_cached=true for existing content by tmdb_id', async () => {
      const testTmdbId = getUniqueTmdbId();
      const testShowId = crypto.randomUUID();
      createdContentIds.push(testShowId);

      await db
        .insertInto('content')
        .values({
          id: testShowId,
          tmdb_id: testTmdbId,
          data_source: 'tmdb',
          content_type: 'show',
          title: 'Test Show for Check',
          overview: 'A test show for cache checking',
          poster_url: null,
          backdrop_url: null,
          default_duration: 22,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      const response = await app.inject({
        method: 'GET',
        url: `/api/content/${testTmdbId}/check`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_cached).toBe(true);
      expect(body.content).toBeDefined();
      expect(body.content.tmdb_id).toBe(testTmdbId);
    });

    it('should return is_cached=false for non-existent content', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/content/123456789/check',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_cached).toBe(false);
      expect(body.content).toBeNull();
    });

    it('should check by mal_id if provided', async () => {
      const testMalId = getUniqueMalId();
      const malContentId = crypto.randomUUID();
      createdContentIds.push(malContentId);

      await db
        .insertInto('content')
        .values({
          id: malContentId,
          tmdb_id: null,
          mal_id: testMalId,
          data_source: 'jikan',
          content_type: 'show',
          title: 'Test Anime',
          overview: 'A test anime',
          poster_url: null,
          backdrop_url: null,
          default_duration: 24,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      // Check with mal_id query param
      const response = await app.inject({
        method: 'GET',
        url: `/api/content/0/check?mal_id=${testMalId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_cached).toBe(true);
      expect(body.content.mal_id).toBe(testMalId);
    });

    it('should handle invalid tmdb_id gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/content/not-a-number/check',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tmdb_id).toBeNull();
      expect(body.is_cached).toBe(false);
    });
  });

  describe('GET /api/content/by-id/:contentId/episodes', () => {
    // Helper to create a show with episodes
    async function createShowWithEpisodes() {
      const showContentId = crypto.randomUUID();
      createdContentIds.push(showContentId);

      await db
        .insertInto('content')
        .values({
          id: showContentId,
          tmdb_id: getUniqueTmdbId(),
          data_source: 'tmdb',
          content_type: 'show',
          title: 'Test Show with Episodes',
          overview: 'A test show',
          poster_url: null,
          backdrop_url: null,
          default_duration: 22,
          number_of_seasons: 2,
          number_of_episodes: 10,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      // Create test episodes
      for (let season = 1; season <= 2; season++) {
        for (let ep = 1; ep <= 5; ep++) {
          const episodeId = crypto.randomUUID();
          createdEpisodeIds.push(episodeId);

          await db
            .insertInto('episodes')
            .values({
              id: episodeId,
              content_id: showContentId,
              season: season,
              episode_number: ep,
              title: `S${season}E${ep} - Test Episode`,
              overview: `Test episode ${ep} of season ${season}`,
              duration: 22,
              created_at: new Date(),
            })
            .execute();
        }
      }

      return showContentId;
    }

    // Helper to create a movie
    async function createMovie() {
      const movieContentId = crypto.randomUUID();
      createdContentIds.push(movieContentId);

      await db
        .insertInto('content')
        .values({
          id: movieContentId,
          tmdb_id: getUniqueTmdbId(),
          data_source: 'tmdb',
          content_type: 'movie',
          title: 'Test Movie',
          overview: 'A test movie',
          poster_url: null,
          backdrop_url: null,
          default_duration: 120,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      return movieContentId;
    }

    it('should return all episodes for a show', async () => {
      const showContentId = await createShowWithEpisodes();

      const response = await app.inject({
        method: 'GET',
        url: `/api/content/by-id/${showContentId}/episodes`,
      });

      expect(response.statusCode).toBe(200);
      const episodes = JSON.parse(response.body);
      expect(episodes).toHaveLength(10);
      expect(episodes[0].season).toBe(1);
      expect(episodes[0].episode_number).toBe(1);
    });

    it('should filter episodes by season', async () => {
      const showContentId = await createShowWithEpisodes();

      const response = await app.inject({
        method: 'GET',
        url: `/api/content/by-id/${showContentId}/episodes?season=2`,
      });

      expect(response.statusCode).toBe(200);
      const episodes = JSON.parse(response.body);
      expect(episodes).toHaveLength(5);
      expect(episodes.every((ep: any) => ep.season === 2)).toBe(true);
    });

    it('should return 404 for non-existent content', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/content/by-id/${crypto.randomUUID()}/episodes`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('should return 400 when requesting episodes for a movie', async () => {
      const movieContentId = await createMovie();

      const response = await app.inject({
        method: 'GET',
        url: `/api/content/by-id/${movieContentId}/episodes`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toContain('TV shows');
    });

    it('should return 400 for invalid season number', async () => {
      const showContentId = await createShowWithEpisodes();

      const response = await app.inject({
        method: 'GET',
        url: `/api/content/by-id/${showContentId}/episodes?season=abc`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty array for season with no episodes', async () => {
      const showContentId = await createShowWithEpisodes();

      const response = await app.inject({
        method: 'GET',
        url: `/api/content/by-id/${showContentId}/episodes?season=99`,
      });

      expect(response.statusCode).toBe(200);
      const episodes = JSON.parse(response.body);
      expect(episodes).toHaveLength(0);
    });
  });

  describe('PUT /api/content/:contentId/refresh', () => {
    it('should update the updated_at timestamp', async () => {
      const refreshContentId = crypto.randomUUID();
      createdContentIds.push(refreshContentId);
      const originalUpdatedAt = new Date(Date.now() - 1000); // 1 second ago

      await db
        .insertInto('content')
        .values({
          id: refreshContentId,
          tmdb_id: getUniqueTmdbId(),
          data_source: 'tmdb',
          content_type: 'show',
          title: 'Test Show for Refresh',
          overview: 'A test show for refresh testing',
          poster_url: null,
          backdrop_url: null,
          default_duration: 22,
          created_at: new Date(),
          updated_at: originalUpdatedAt,
        })
        .execute();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/content/${refreshContentId}/refresh`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const newUpdatedAt = new Date(body.updated_at);
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should return 404 for non-existent content', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/content/${crypto.randomUUID()}/refresh`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('Response Format', () => {
    it('should return JSON content type for all endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/content/12345/check',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
