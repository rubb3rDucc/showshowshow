/**
 * Integration tests for queue routes
 * Tests queue management operations with database
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { NotFoundError, ValidationError } from '../../src/lib/errors.js';
import { sql } from 'kysely';

// Generate unique IDs for each test run
const getUniqueTmdbId = () => 9100000 + Math.floor(Math.random() * 100000);

// Test user ID (simulating authenticated user) - must be a valid UUID
const testUserId = crypto.randomUUID();

/**
 * Create simplified queue routes for testing
 * (without Clerk auth dependency - simulates authenticated user)
 */
async function createQueueRoutes(fastify: FastifyInstance, userId: string) {
  // Get user's queue
  fastify.get('/api/queue', async (request, reply) => {
    const queue = await db
      .selectFrom('queue')
      .innerJoin('content', 'queue.content_id', 'content.id')
      .select([
        'queue.id',
        'queue.position',
        'queue.season',
        'queue.episode',
        'queue.created_at',
        'content.id as content_id',
        'content.tmdb_id',
        'content.title',
        'content.poster_url',
        'content.content_type',
      ])
      .where('queue.user_id', '=', userId)
      .orderBy('queue.position', 'asc')
      .execute();

    return reply.send(queue);
  });

  // Add item to queue
  fastify.post('/api/queue', async (request, reply) => {
    const { content_id, season, episode } = request.body as {
      content_id?: string;
      season?: number;
      episode?: number
    };

    if (!content_id) {
      throw new ValidationError('content_id is required');
    }

    // Verify content exists
    const content = await db
      .selectFrom('content')
      .select(['id', 'content_type'])
      .where('id', '=', content_id)
      .executeTakeFirst();

    if (!content) {
      throw new NotFoundError('Content not found');
    }

    // Get current max position
    const maxPosition = await db
      .selectFrom('queue')
      .select((eb) => eb.fn.max('position').as('max'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const newPosition = (maxPosition?.max ?? -1) + 1;

    // Check if already in queue
    // Note: Use IS NULL for null comparisons to properly detect duplicates
    let existingQuery = db
      .selectFrom('queue')
      .select('id')
      .where('user_id', '=', userId)
      .where('content_id', '=', content_id);

    if (season === undefined || season === null) {
      existingQuery = existingQuery.where('season', 'is', null);
    } else {
      existingQuery = existingQuery.where('season', '=', season);
    }

    if (episode === undefined || episode === null) {
      existingQuery = existingQuery.where('episode', 'is', null);
    } else {
      existingQuery = existingQuery.where('episode', '=', episode);
    }

    const existing = await existingQuery.executeTakeFirst();

    if (existing) {
      throw new ValidationError('Item already in queue');
    }

    // Add to queue
    const queueItem = await db
      .insertInto('queue')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        content_id,
        season: season ?? null,
        episode: episode ?? null,
        position: newPosition,
        synced: false,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(queueItem);
  });

  // Remove item from queue
  fastify.delete('/api/queue/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership
    const queueItem = await db
      .selectFrom('queue')
      .select(['id', 'content_id', 'position'])
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!queueItem) {
      throw new NotFoundError('Queue item not found');
    }

    // Delete item
    await db.deleteFrom('queue').where('id', '=', id).execute();

    // Reorder remaining items
    const remainingItems = await db
      .selectFrom('queue')
      .select(['id', 'position'])
      .where('user_id', '=', userId)
      .orderBy('position', 'asc')
      .execute();

    if (remainingItems.length > 0) {
      const caseExpressions = remainingItems.map((item, i) => `WHEN '${item.id}' THEN ${i}`).join(' ');
      const itemIds = remainingItems.map(item => `'${item.id}'`).join(', ');

      await sql`
        UPDATE queue
        SET position = CASE id ${sql.raw(caseExpressions)} END
        WHERE id IN (${sql.raw(itemIds)})
      `.execute(db);
    }

    return reply.send({ success: true });
  });

  // Reorder queue
  fastify.put('/api/queue/reorder', async (request, reply) => {
    const { item_ids } = request.body as { item_ids?: string[] };

    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      throw new ValidationError('item_ids must be a non-empty array');
    }

    // Verify all items belong to user
    const userItems = await db
      .selectFrom('queue')
      .select('id')
      .where('user_id', '=', userId)
      .where('id', 'in', item_ids)
      .execute();

    if (userItems.length !== item_ids.length) {
      throw new ValidationError('Some queue items not found or don\'t belong to user');
    }

    // Batch update positions
    const caseExpressions = item_ids.map((id, i) => `WHEN '${id}' THEN ${i}`).join(' ');
    const itemIdsList = item_ids.map(id => `'${id}'`).join(', ');

    await sql`
      UPDATE queue
      SET position = CASE id ${sql.raw(caseExpressions)} END
      WHERE id IN (${sql.raw(itemIdsList)})
    `.execute(db);

    return reply.send({ success: true });
  });

  // Clear queue
  fastify.delete('/api/queue/clear', async (request, reply) => {
    await db.deleteFrom('queue').where('user_id', '=', userId).execute();
    return reply.send({ success: true });
  });
}

describe('Queue Routes', { sequential: true }, () => {
  let app: FastifyInstance;
  const createdContentIds: string[] = [];

  beforeAll(async () => {
    // Clean up any previous test data
    await db.deleteFrom('queue').where('user_id', '=', testUserId).execute();

    // Create test user (required for foreign key constraint)
    await db
      .insertInto('users')
      .values({
        id: testUserId,
        clerk_user_id: `clerk_test_${Date.now()}`,
        email: `test-queue-${Date.now()}@example.com`,
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
    await createQueueRoutes(app, testUserId);
    await app.ready();
  });

  // Clear queue before each test to ensure isolation
  beforeEach(async () => {
    await db.deleteFrom('queue').where('user_id', '=', testUserId).execute();
  });

  afterAll(async () => {
    // Clean up test data
    await db.deleteFrom('queue').where('user_id', '=', testUserId).execute();
    if (createdContentIds.length > 0) {
      await db
        .deleteFrom('content')
        .where('id', 'in', createdContentIds)
        .execute();
    }
    // Delete test user
    await db.deleteFrom('users').where('id', '=', testUserId).execute();
    await app.close();
  });

  // Helper to create test content
  async function createTestContent(type: 'show' | 'movie' = 'show') {
    const contentId = crypto.randomUUID();
    createdContentIds.push(contentId);

    await db
      .insertInto('content')
      .values({
        id: contentId,
        tmdb_id: getUniqueTmdbId(),
        data_source: 'tmdb',
        content_type: type,
        title: `Test ${type} for Queue`,
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

  describe('GET /api/queue', () => {
    it('should return empty queue for new user', async () => {
            const response = await app.inject({
        method: 'GET',
        url: '/api/queue',
      });

      expect(response.statusCode).toBe(200);
      const queue = JSON.parse(response.body);
      expect(queue).toEqual([]);
    });

    it('should return queue items in order', async () => {
            const content1 = await createTestContent('show');
      const content2 = await createTestContent('movie');

      // Add items to queue
      await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content1 },
      });
      await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content2 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/queue',
      });

      expect(response.statusCode).toBe(200);
      const queue = JSON.parse(response.body);
      expect(queue).toHaveLength(2);
      expect(queue[0].position).toBe(0);
      expect(queue[1].position).toBe(1);
      expect(queue[0].content_id).toBe(content1);
      expect(queue[1].content_id).toBe(content2);
    });
  });

  describe('POST /api/queue', () => {
    it('should add content to queue', async () => {
      // Queue is cleared automatically by beforeEach
      const contentId = await createTestContent();

      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: contentId },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.content_id).toBe(contentId);
      expect(body.position).toBe(0);
      expect(body.user_id).toBe(testUserId);
    });

    it('should add content with season and episode', async () => {
      // Queue is cleared automatically by beforeEach
      const contentId = await createTestContent('show');

      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: contentId, season: 1, episode: 5 },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.season).toBe(1);
      expect(body.episode).toBe(5);
    });

    it('should return 400 when content_id is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: crypto.randomUUID() },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('should reject duplicate queue item', async () => {
      // Queue is cleared automatically by beforeEach
      const contentId = await createTestContent();

      // First add should succeed
      const firstAdd = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: contentId },
      });
      expect(firstAdd.statusCode).toBe(201); // Ensure first add worked

      // Second add should fail
      const response = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: contentId },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already in queue');
    });

    it('should increment position for each new item', async () => {
            const content1 = await createTestContent();
      const content2 = await createTestContent();
      const content3 = await createTestContent();

      const resp1 = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content1 },
      });
      const resp2 = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content2 },
      });
      const resp3 = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content3 },
      });

      expect(JSON.parse(resp1.body).position).toBe(0);
      expect(JSON.parse(resp2.body).position).toBe(1);
      expect(JSON.parse(resp3.body).position).toBe(2);
    });
  });

  describe('DELETE /api/queue/:id', () => {
    it('should remove item from queue', async () => {
      // Queue is cleared automatically by beforeEach
      const contentId = await createTestContent();

      // Add item
      const addResponse = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: contentId },
      });
      const queueItem = JSON.parse(addResponse.body);

      // Remove item
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/queue/${queueItem.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify queue is empty
      const queue = await app.inject({
        method: 'GET',
        url: '/api/queue',
      });
      expect(JSON.parse(queue.body)).toHaveLength(0);
    });

    it('should reorder remaining items after deletion', async () => {
            const content1 = await createTestContent();
      const content2 = await createTestContent();
      const content3 = await createTestContent();

      // Add 3 items
      const resp1 = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content1 },
      });
      await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content2 },
      });
      await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content3 },
      });

      // Delete first item
      const firstItem = JSON.parse(resp1.body);
      await app.inject({
        method: 'DELETE',
        url: `/api/queue/${firstItem.id}`,
      });

      // Check remaining positions
      const queue = await app.inject({
        method: 'GET',
        url: '/api/queue',
      });
      const items = JSON.parse(queue.body);
      expect(items).toHaveLength(2);
      expect(items[0].position).toBe(0);
      expect(items[1].position).toBe(1);
    });

    it('should return 404 for non-existent queue item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/queue/${crypto.randomUUID()}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/queue/reorder', () => {
    it('should reorder queue items', async () => {
      const content1 = await createTestContent();
      const content2 = await createTestContent();
      const content3 = await createTestContent();

      // Add 3 items
      const resp1 = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content1 },
      });
      expect(resp1.statusCode).toBe(201);

      const resp2 = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content2 },
      });
      expect(resp2.statusCode).toBe(201);

      const resp3 = await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content3 },
      });
      expect(resp3.statusCode).toBe(201);

      const id1 = JSON.parse(resp1.body).id;
      const id2 = JSON.parse(resp2.body).id;
      const id3 = JSON.parse(resp3.body).id;

      // Reorder: move item 3 to first
      const response = await app.inject({
        method: 'PUT',
        url: '/api/queue/reorder',
        payload: { item_ids: [id3, id1, id2] },
      });

      expect(response.statusCode).toBe(200);

      // Verify new order
      const queue = await app.inject({
        method: 'GET',
        url: '/api/queue',
      });
      const items = JSON.parse(queue.body);
      expect(items[0].id).toBe(id3);
      expect(items[1].id).toBe(id1);
      expect(items[2].id).toBe(id2);
    });

    it('should return 400 for empty item_ids', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/queue/reorder',
        payload: { item_ids: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing item_ids', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/queue/reorder',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid item IDs', async () => {
      // Queue is cleared automatically by beforeEach
      const response = await app.inject({
        method: 'PUT',
        url: '/api/queue/reorder',
        payload: { item_ids: [crypto.randomUUID(), crypto.randomUUID()] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });
  });

  describe('DELETE /api/queue/clear', () => {
    it('should clear all queue items', async () => {
            // Add some items first
      const content1 = await createTestContent();
      const content2 = await createTestContent();

      await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content1 },
      });
      await app.inject({
        method: 'POST',
        url: '/api/queue',
        payload: { content_id: content2 },
      });

      // Clear queue
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/queue/clear',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify queue is empty
      const queue = await app.inject({
        method: 'GET',
        url: '/api/queue',
      });
      expect(JSON.parse(queue.body)).toHaveLength(0);
    });

    it('should succeed even if queue is already empty', async () => {
            const response = await app.inject({
        method: 'DELETE',
        url: '/api/queue/clear',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/queue',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
