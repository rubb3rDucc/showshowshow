/**
 * Integration tests for library routes
 * Tests library pagination, filtering, and response shape
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { parsePaginationParams, calculateProgress } from '../../src/lib/utils.js';

const getUniqueTmdbId = () => 9200000 + Math.floor(Math.random() * 100000);

const testUserId = crypto.randomUUID();

async function createLibraryRoutes(fastify: FastifyInstance, userId: string) {
  fastify.get('/api/library', async (request, reply) => {
    const { status, type, search, page, limit } = request.query as {
      status?: string;
      type?: 'show' | 'movie' | 'all';
      search?: string;
      page?: string;
      limit?: string;
    };

    const { page: pageNum, limit: limitNum, offset } = parsePaginationParams({ page, limit });

    let query = db
      .selectFrom('user_library')
      .innerJoin('content', 'user_library.content_id', 'content.id')
      .select([
        'user_library.id',
        'user_library.user_id',
        'user_library.content_id',
        'user_library.status',
        'user_library.current_season',
        'user_library.current_episode',
        'user_library.score',
        'user_library.notes',
        'user_library.started_at',
        'user_library.completed_at',
        'user_library.last_watched_at',
        'user_library.episodes_watched',
        'user_library.created_at',
        'user_library.updated_at',
        'content.id as content_id',
        'content.title',
        'content.poster_url',
        'content.content_type',
        'content.number_of_episodes',
        'content.number_of_seasons',
      ])
      .where('user_library.user_id', '=', userId);

    if (status && status !== 'all') {
      query = query.where('user_library.status', '=', status as any);
    }
    if (type && type !== 'all') {
      query = query.where('content.content_type', '=', type);
    }
    if (search && search.trim().length > 0) {
      query = query.where('content.title', 'ilike', `%${search.trim()}%`);
    }

    const countResult = await db
      .selectFrom('user_library')
      .innerJoin('content', 'user_library.content_id', 'content.id')
      .select(db.fn.count('user_library.id').as('count'))
      .where('user_library.user_id', '=', userId)
      .$if(!!status && status !== 'all', (qb) => qb.where('user_library.status', '=', status as any))
      .$if(!!type && type !== 'all', (qb) => qb.where('content.content_type', '=', type as 'show' | 'movie'))
      .$if(!!search && search.trim().length > 0, (qb) => qb.where('content.title', 'ilike', `%${search?.trim()}%`))
      .executeTakeFirst();

    const totalItems = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalItems / limitNum);

    const libraryItems = await query
      .orderBy('user_library.updated_at', 'desc')
      .limit(limitNum)
      .offset(offset)
      .execute();

    const itemsWithProgress = libraryItems.map((item) => {
      const progress = calculateProgress(item.number_of_episodes, item.episodes_watched);
      return {
        ...item,
        content: {
          id: item.content_id,
          title: item.title,
          poster_url: item.poster_url,
          content_type: item.content_type,
          number_of_episodes: item.number_of_episodes,
          number_of_seasons: item.number_of_seasons,
        },
        progress: {
          episodes_watched: progress.watched,
          total_episodes: progress.total,
          percentage: progress.percentage,
        },
      };
    });

    return reply.send({
      items: itemsWithProgress,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_items: totalItems,
        total_pages: totalPages,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1,
      },
    });
  });
}

describe('Library Routes', { sequential: true }, () => {
  let app: FastifyInstance;
  const createdContentIds: string[] = [];

  beforeAll(async () => {
    await db.deleteFrom('user_library').where('user_id', '=', testUserId).execute();

    await db
      .insertInto('users')
      .values({
        id: testUserId,
        clerk_user_id: `clerk_test_lib_${Date.now()}`,
        email: `test-library-${Date.now()}@example.com`,
        password_hash: null,
        auth_provider: 'clerk',
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    app = Fastify({ logger: false });
    app.decorate('db', db);
    await app.register(errorHandlerPlugin);
    await createLibraryRoutes(app, testUserId);
    await app.ready();
  });

  beforeEach(async () => {
    await db.deleteFrom('user_library').where('user_id', '=', testUserId).execute();
  });

  afterAll(async () => {
    await db.deleteFrom('user_library').where('user_id', '=', testUserId).execute();
    if (createdContentIds.length > 0) {
      await db.deleteFrom('content').where('id', 'in', createdContentIds).execute();
    }
    await db.deleteFrom('users').where('id', '=', testUserId).execute();
    await app.close();
  });

  async function createTestContent(type: 'show' | 'movie' = 'show', title?: string) {
    const contentId = crypto.randomUUID();
    createdContentIds.push(contentId);
    await db
      .insertInto('content')
      .values({
        id: contentId,
        tmdb_id: getUniqueTmdbId(),
        data_source: 'tmdb',
        content_type: type,
        title: title ?? `Test ${type} ${Date.now()}`,
        overview: `A test ${type}`,
        poster_url: null,
        backdrop_url: null,
        default_duration: type === 'show' ? 22 : 120,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
    return contentId;
  }

  async function addToLibrary(contentId: string, status: 'watching' | 'completed' | 'dropped' | 'plan_to_watch' = 'plan_to_watch') {
    await db
      .insertInto('user_library')
      .values({
        id: crypto.randomUUID(),
        user_id: testUserId,
        content_id: contentId,
        status,
        current_season: 1,
        current_episode: 1,
        started_at: status === 'watching' ? new Date() : null,
        episodes_watched: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }

  describe('Response shape', () => {
    it('returns { items, pagination } for empty library', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/library' });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items).toHaveLength(0);
    });

    it('returns correct pagination fields', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/library' });
      const { pagination } = JSON.parse(response.body);

      expect(pagination).toMatchObject({
        page: 1,
        limit: 50,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      });
    });

    it('items include a progress object', async () => {
      const contentId = await createTestContent('show');
      await addToLibrary(contentId);

      const response = await app.inject({ method: 'GET', url: '/api/library' });
      const { items } = JSON.parse(response.body);

      expect(items[0]).toHaveProperty('progress');
      expect(items[0].progress).toMatchObject({
        episodes_watched: expect.any(Number),
        total_episodes: expect.any(Number),
        percentage: expect.any(Number),
      });
    });
  });

  describe('Pagination', () => {
    it('total_items reflects the full library count', async () => {
      const c1 = await createTestContent();
      const c2 = await createTestContent();
      const c3 = await createTestContent();
      await addToLibrary(c1);
      await addToLibrary(c2);
      await addToLibrary(c3);

      const response = await app.inject({ method: 'GET', url: '/api/library' });
      const { pagination } = JSON.parse(response.body);

      expect(pagination.total_items).toBe(3);
    });

    it('respects the limit param', async () => {
      for (let i = 0; i < 5; i++) {
        const c = await createTestContent();
        await addToLibrary(c);
      }

      const response = await app.inject({ method: 'GET', url: '/api/library?limit=2' });
      const body = JSON.parse(response.body);

      expect(body.items).toHaveLength(2);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.total_items).toBe(5);
      expect(body.pagination.total_pages).toBe(3);
    });

    it('has_next is true when more pages exist', async () => {
      for (let i = 0; i < 3; i++) {
        const c = await createTestContent();
        await addToLibrary(c);
      }

      const response = await app.inject({ method: 'GET', url: '/api/library?limit=2' });
      const { pagination } = JSON.parse(response.body);

      expect(pagination.has_next).toBe(true);
      expect(pagination.has_prev).toBe(false);
    });

    it('has_next is false on the last page', async () => {
      for (let i = 0; i < 3; i++) {
        const c = await createTestContent();
        await addToLibrary(c);
      }

      const response = await app.inject({ method: 'GET', url: '/api/library?page=2&limit=2' });
      const { pagination } = JSON.parse(response.body);

      expect(pagination.has_next).toBe(false);
      expect(pagination.has_prev).toBe(true);
    });

    it('page 2 returns different items than page 1 with no overlap', async () => {
      const contentIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const c = await createTestContent();
        contentIds.push(c);
        await addToLibrary(c);
      }

      const page1 = await app.inject({ method: 'GET', url: '/api/library?page=1&limit=2' });
      const page2 = await app.inject({ method: 'GET', url: '/api/library?page=2&limit=2' });

      const ids1 = JSON.parse(page1.body).items.map((i: any) => i.content_id);
      const ids2 = JSON.parse(page2.body).items.map((i: any) => i.content_id);

      expect(ids1).toHaveLength(2);
      expect(ids2).toHaveLength(2);

      // No overlap between pages
      const overlap = ids1.filter((id: string) => ids2.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('returns empty items array on a page beyond total_pages', async () => {
      const c = await createTestContent();
      await addToLibrary(c);

      const response = await app.inject({ method: 'GET', url: '/api/library?page=99&limit=50' });
      const body = JSON.parse(response.body);

      expect(body.items).toHaveLength(0);
      expect(body.pagination.has_next).toBe(false);
    });
  });

  describe('Filtering', () => {
    it('filters by status', async () => {
      const watching = await createTestContent('show', 'Currently Watching');
      const completed = await createTestContent('show', 'Already Done');
      await addToLibrary(watching, 'watching');
      await addToLibrary(completed, 'completed');

      const response = await app.inject({ method: 'GET', url: '/api/library?status=watching' });
      const { items, pagination } = JSON.parse(response.body);

      expect(items).toHaveLength(1);
      expect(items[0].status).toBe('watching');
      expect(pagination.total_items).toBe(1);
    });

    it('filters by type', async () => {
      const show = await createTestContent('show', 'A TV Show');
      const movie = await createTestContent('movie', 'A Movie');
      await addToLibrary(show);
      await addToLibrary(movie);

      const response = await app.inject({ method: 'GET', url: '/api/library?type=movie' });
      const { items, pagination } = JSON.parse(response.body);

      expect(items).toHaveLength(1);
      expect(items[0].content.content_type).toBe('movie');
      expect(pagination.total_items).toBe(1);
    });

    it('total_items reflects filtered count, not total library size', async () => {
      for (let i = 0; i < 3; i++) {
        const c = await createTestContent('show');
        await addToLibrary(c, 'watching');
      }
      for (let i = 0; i < 2; i++) {
        const c = await createTestContent('show');
        await addToLibrary(c, 'completed');
      }

      const response = await app.inject({ method: 'GET', url: '/api/library?status=watching' });
      const { pagination } = JSON.parse(response.body);

      expect(pagination.total_items).toBe(3);
    });

    it('filter + pagination work together', async () => {
      for (let i = 0; i < 5; i++) {
        const c = await createTestContent('show');
        await addToLibrary(c, 'watching');
      }
      const movie = await createTestContent('movie');
      await addToLibrary(movie, 'watching');

      const response = await app.inject({ method: 'GET', url: '/api/library?type=show&limit=2' });
      const { items, pagination } = JSON.parse(response.body);

      expect(items).toHaveLength(2);
      expect(pagination.total_items).toBe(5);
      expect(pagination.has_next).toBe(true);
      items.forEach((item: any) => expect(item.content.content_type).toBe('show'));
    });
  });
});
