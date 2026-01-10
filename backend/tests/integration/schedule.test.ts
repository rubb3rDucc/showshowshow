/**
 * Integration tests for schedule routes
 * Tests CRUD operations and watched status management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../src/db/index.js';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { NotFoundError, ValidationError } from '../../src/lib/errors.js';

// Generate unique IDs for each test run
const getUniqueTmdbId = () => 7000000 + Math.floor(Math.random() * 100000);

/**
 * Create simplified schedule routes for testing
 * (without Clerk auth dependency)
 */
async function createScheduleRoutes(fastify: FastifyInstance, testUserId: string) {
  // Get user's schedule
  fastify.get('/api/schedule', async (request, reply) => {
    const { start, end } = request.query as { start?: string; end?: string };

    let query = db
      .selectFrom('schedule')
      .innerJoin('content', 'schedule.content_id', 'content.id')
      .select([
        'schedule.id',
        'schedule.scheduled_time',
        'schedule.season',
        'schedule.episode',
        'schedule.duration',
        'schedule.source_type',
        'schedule.watched',
        'schedule.timezone_offset',
        'content.id as content_id',
        'content.tmdb_id',
        'content.title',
        'content.poster_url',
        'content.content_type',
      ])
      .where('schedule.user_id', '=', testUserId)
      .orderBy('schedule.scheduled_time', 'asc');

    if (start) {
      query = query.where('schedule.scheduled_time', '>=', new Date(start));
    }
    if (end) {
      query = query.where('schedule.scheduled_time', '<=', new Date(end));
    }

    const schedule = await query.execute();
    return reply.send(schedule);
  });

  // Get schedule for specific date
  fastify.get('/api/schedule/date/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    const { timezone_offset } = request.query as { timezone_offset?: string };

    const [year, month, day] = date.split('-').map(Number);

    let offsetMinutes = 0;
    if (timezone_offset) {
      const offsetMatch = timezone_offset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (offsetMatch) {
        const [, sign, hours, minutes] = offsetMatch;
        offsetMinutes = (sign === '-' ? -1 : 1) * (parseInt(hours) * 60 + parseInt(minutes));
      }
    }

    const localMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const startDate = new Date(localMidnight - offsetMinutes * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    const schedule = await db
      .selectFrom('schedule')
      .innerJoin('content', 'schedule.content_id', 'content.id')
      .select([
        'schedule.id',
        'schedule.scheduled_time',
        'schedule.season',
        'schedule.episode',
        'schedule.duration',
        'schedule.watched',
        'content.id as content_id',
        'content.title',
        'content.content_type',
      ])
      .where('schedule.user_id', '=', testUserId)
      .where('schedule.scheduled_time', '>=', startDate)
      .where('schedule.scheduled_time', '<', endDate)
      .orderBy('schedule.scheduled_time', 'asc')
      .execute();

    return reply.send(schedule);
  });

  // Create schedule item
  fastify.post('/api/schedule', async (request, reply) => {
    const { content_id, season, episode, scheduled_time, duration } = request.body as {
      content_id?: string;
      season?: number;
      episode?: number;
      scheduled_time?: string;
      duration?: number;
    };

    if (!content_id || !scheduled_time) {
      throw new ValidationError('content_id and scheduled_time are required');
    }

    const content = await db
      .selectFrom('content')
      .select(['id', 'default_duration'])
      .where('id', '=', content_id)
      .executeTakeFirst();

    if (!content) {
      throw new NotFoundError('Content not found');
    }

    let finalDuration = duration;
    if (!finalDuration && season !== null && season !== undefined && episode !== null && episode !== undefined) {
      const episodeData = await db
        .selectFrom('episodes')
        .select('duration')
        .where('content_id', '=', content_id)
        .where('season', '=', season)
        .where('episode_number', '=', episode)
        .executeTakeFirst();
      finalDuration = episodeData?.duration ?? content.default_duration;
    } else {
      finalDuration = finalDuration ?? content.default_duration;
    }

    const scheduleItem = await db
      .insertInto('schedule')
      .values({
        id: crypto.randomUUID(),
        user_id: testUserId,
        content_id,
        season: season ?? null,
        episode: episode ?? null,
        scheduled_time: new Date(scheduled_time),
        duration: finalDuration,
        source_type: 'manual',
        source_id: null,
        watched: false,
        synced: false,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(scheduleItem);
  });

  // Update schedule item
  fastify.put('/api/schedule/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as { scheduled_time?: string; watched?: boolean };

    const existing = await db
      .selectFrom('schedule')
      .select(['id', 'scheduled_time', 'content_id'])
      .where('id', '=', id)
      .where('user_id', '=', testUserId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Schedule item not found');
    }

    const updateData: Record<string, unknown> = {};
    if (updates.scheduled_time !== undefined) {
      updateData.scheduled_time = new Date(updates.scheduled_time);
    }
    if (updates.watched !== undefined) {
      updateData.watched = updates.watched;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    const updated = await db
      .updateTable('schedule')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.send(updated);
  });

  // Delete schedule item
  fastify.delete('/api/schedule/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db
      .selectFrom('schedule')
      .select(['id'])
      .where('id', '=', id)
      .where('user_id', '=', testUserId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Schedule item not found');
    }

    await db.deleteFrom('schedule').where('id', '=', id).execute();

    return reply.send({ success: true });
  });

  // Clear all schedule items
  fastify.delete('/api/schedule', async (request, reply) => {
    const result = await db
      .deleteFrom('schedule')
      .where('user_id', '=', testUserId)
      .execute();

    return reply.send({
      success: true,
      message: `Cleared ${result.length > 0 ? result[0].numDeletedRows : 0} schedule items`,
    });
  });

  // Clear schedule items for specific date
  fastify.delete('/api/schedule/date/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    const { timezone_offset } = request.query as { timezone_offset?: string };

    const [year, month, day] = date.split('-').map(Number);

    let offsetMinutes = 0;
    if (timezone_offset) {
      const offsetMatch = timezone_offset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (offsetMatch) {
        const [, sign, hours, minutes] = offsetMatch;
        offsetMinutes = (sign === '-' ? -1 : 1) * (parseInt(hours) * 60 + parseInt(minutes));
      }
    }

    const localMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const startDate = new Date(localMidnight - offsetMinutes * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    const deleted = await db
      .deleteFrom('schedule')
      .where('user_id', '=', testUserId)
      .where('scheduled_time', '>=', startDate)
      .where('scheduled_time', '<', endDate)
      .execute();

    const count = deleted.length > 0 ? Number(deleted[0].numDeletedRows) : 0;

    return reply.send({
      success: true,
      message: `Cleared ${count} schedule item${count !== 1 ? 's' : ''} for ${date}`,
    });
  });

  // Mark schedule item as watched (simplified for testing)
  fastify.post('/api/schedule/:id/watched', async (request, reply) => {
    const { id } = request.params as { id: string };

    const scheduleItem = await db
      .selectFrom('schedule')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', testUserId)
      .executeTakeFirst();

    if (!scheduleItem) {
      throw new NotFoundError('Schedule item not found');
    }

    await db
      .updateTable('schedule')
      .set({ watched: true })
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true });
  });

  // Unmark schedule item as watched (simplified for testing)
  fastify.delete('/api/schedule/:id/watched', async (request, reply) => {
    const { id } = request.params as { id: string };

    const scheduleItem = await db
      .selectFrom('schedule')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', testUserId)
      .executeTakeFirst();

    if (!scheduleItem) {
      throw new NotFoundError('Schedule item not found');
    }

    await db
      .updateTable('schedule')
      .set({ watched: false })
      .where('id', '=', id)
      .execute();

    return reply.send({ success: true, watched_at: null });
  });
}

describe('Schedule Routes', { sequential: true }, () => {
  let app: FastifyInstance;
  const testUserId = crypto.randomUUID();
  const createdContentIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const createdEpisodeIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    await db
      .insertInto('users')
      .values({
        id: testUserId,
        clerk_user_id: `clerk_schedule_${Date.now()}`,
        email: `test-schedule-${Date.now()}@example.com`,
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
    await createScheduleRoutes(app, testUserId);
    await app.ready();
  });

  afterAll(async () => {
    // Clean up in correct order (foreign key constraints)
    if (createdScheduleIds.length > 0) {
      await db.deleteFrom('schedule').where('id', 'in', createdScheduleIds).execute();
    }
    if (createdEpisodeIds.length > 0) {
      await db.deleteFrom('episodes').where('id', 'in', createdEpisodeIds).execute();
    }
    if (createdContentIds.length > 0) {
      await db.deleteFrom('content').where('id', 'in', createdContentIds).execute();
    }
    // Clean up test user
    await db.deleteFrom('users').where('id', '=', testUserId).execute();
    await app.close();
  });

  beforeEach(async () => {
    // Clear schedule for isolation
    await db.deleteFrom('schedule').where('user_id', '=', testUserId).execute();
    createdScheduleIds.length = 0;
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
        title: `Test ${type === 'show' ? 'Show' : 'Movie'} ${Date.now()}`,
        overview: `A test ${type}`,
        poster_url: null,
        backdrop_url: null,
        default_duration: type === 'movie' ? 120 : 22,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    return contentId;
  }

  // Helper to create test episodes
  async function createTestEpisodes(contentId: string, count: number = 5) {
    const episodeIds: string[] = [];
    for (let i = 1; i <= count; i++) {
      const episodeId = crypto.randomUUID();
      episodeIds.push(episodeId);
      createdEpisodeIds.push(episodeId);

      await db
        .insertInto('episodes')
        .values({
          id: episodeId,
          content_id: contentId,
          season: 1,
          episode_number: i,
          title: `Episode ${i}`,
          overview: `Test episode ${i}`,
          duration: 22,
          created_at: new Date(),
        })
        .execute();
    }
    return episodeIds;
  }

  // Helper to create schedule item directly
  async function createScheduleItem(contentId: string, scheduledTime: Date, options: { season?: number; episode?: number; watched?: boolean } = {}) {
    const scheduleId = crypto.randomUUID();
    createdScheduleIds.push(scheduleId);

    await db
      .insertInto('schedule')
      .values({
        id: scheduleId,
        user_id: testUserId,
        content_id: contentId,
        season: options.season ?? null,
        episode: options.episode ?? null,
        scheduled_time: scheduledTime,
        duration: 22,
        source_type: 'manual',
        source_id: null,
        watched: options.watched ?? false,
        synced: false,
        created_at: new Date(),
      })
      .execute();

    return scheduleId;
  }

  describe('GET /api/schedule', () => {
    it('should return empty array when no schedule items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedule',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual([]);
    });

    it('should return all schedule items ordered by time', async () => {
      const contentId = await createTestContent();
      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later

      await createScheduleItem(contentId, later);
      await createScheduleItem(contentId, now);

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedule',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);
      // Should be ordered by time ascending
      expect(new Date(body[0].scheduled_time).getTime()).toBeLessThan(
        new Date(body[1].scheduled_time).getTime()
      );
    });

    it('should filter by start date', async () => {
      const contentId = await createTestContent();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await createScheduleItem(contentId, yesterday);
      await createScheduleItem(contentId, tomorrow);

      const response = await app.inject({
        method: 'GET',
        url: `/api/schedule?start=${new Date().toISOString()}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
    });

    it('should filter by end date', async () => {
      const contentId = await createTestContent();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await createScheduleItem(contentId, yesterday);
      await createScheduleItem(contentId, tomorrow);

      const response = await app.inject({
        method: 'GET',
        url: `/api/schedule?end=${new Date().toISOString()}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
    });

    it('should filter by both start and end date', async () => {
      const contentId = await createTestContent();
      const now = Date.now();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);
      const today = new Date(now);
      const tomorrow = new Date(now + 24 * 60 * 60 * 1000);

      await createScheduleItem(contentId, yesterday);
      await createScheduleItem(contentId, today);
      await createScheduleItem(contentId, tomorrow);

      const start = new Date(now - 12 * 60 * 60 * 1000).toISOString();
      const end = new Date(now + 12 * 60 * 60 * 1000).toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/schedule?start=${start}&end=${end}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
    });
  });

  describe('GET /api/schedule/date/:date', () => {
    it('should return schedule items for specific date', async () => {
      const contentId = await createTestContent();
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Create item for today at noon UTC
      const noonToday = new Date(`${todayStr}T12:00:00Z`);
      await createScheduleItem(contentId, noonToday);

      const response = await app.inject({
        method: 'GET',
        url: `/api/schedule/date/${todayStr}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
    });

    it('should return empty array for date with no items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedule/date/2099-12-31',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual([]);
    });

    it('should handle timezone offset correctly', async () => {
      const contentId = await createTestContent();
      // Create item at 22:00 UTC on Jan 10
      // For EST (-05:00), this would be 17:00 on Jan 10
      const scheduledTime = new Date('2025-01-10T22:00:00Z');
      await createScheduleItem(contentId, scheduledTime);

      // Query for Jan 10 in EST
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedule/date/2025-01-10?timezone_offset=-05:00',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
    });
  });

  describe('POST /api/schedule', () => {
    it('should create a schedule item', async () => {
      const contentId = await createTestContent();
      const scheduledTime = new Date(Date.now() + 60 * 60 * 1000);

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedule',
        payload: {
          content_id: contentId,
          scheduled_time: scheduledTime.toISOString(),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.content_id).toBe(contentId);
      expect(body.watched).toBe(false);
      expect(body.source_type).toBe('manual');
      createdScheduleIds.push(body.id);
    });

    it('should create schedule item with season and episode', async () => {
      const contentId = await createTestContent();
      await createTestEpisodes(contentId);
      const scheduledTime = new Date(Date.now() + 60 * 60 * 1000);

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedule',
        payload: {
          content_id: contentId,
          scheduled_time: scheduledTime.toISOString(),
          season: 1,
          episode: 3,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.season).toBe(1);
      expect(body.episode).toBe(3);
      createdScheduleIds.push(body.id);
    });

    it('should use custom duration if provided', async () => {
      const contentId = await createTestContent();
      const scheduledTime = new Date(Date.now() + 60 * 60 * 1000);

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedule',
        payload: {
          content_id: contentId,
          scheduled_time: scheduledTime.toISOString(),
          duration: 45,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.duration).toBe(45);
      createdScheduleIds.push(body.id);
    });

    it('should reject missing content_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedule',
        payload: {
          scheduled_time: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing scheduled_time', async () => {
      const contentId = await createTestContent();

      const response = await app.inject({
        method: 'POST',
        url: '/api/schedule',
        payload: {
          content_id: contentId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/schedule',
        payload: {
          content_id: crypto.randomUUID(),
          scheduled_time: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/schedule/:id', () => {
    it('should update scheduled_time', async () => {
      const contentId = await createTestContent();
      const originalTime = new Date(Date.now() + 60 * 60 * 1000);
      const scheduleId = await createScheduleItem(contentId, originalTime);

      const newTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedule/${scheduleId}`,
        payload: {
          scheduled_time: newTime.toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(new Date(body.scheduled_time).getTime()).toBe(newTime.getTime());
    });

    it('should update watched status', async () => {
      const contentId = await createTestContent();
      const scheduleId = await createScheduleItem(contentId, new Date());

      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedule/${scheduleId}`,
        payload: {
          watched: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.watched).toBe(true);
    });

    it('should return 404 for non-existent schedule item', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedule/${crypto.randomUUID()}`,
        payload: {
          watched: true,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject empty updates', async () => {
      const contentId = await createTestContent();
      const scheduleId = await createScheduleItem(contentId, new Date());

      const response = await app.inject({
        method: 'PUT',
        url: `/api/schedule/${scheduleId}`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/schedule/:id', () => {
    it('should delete a schedule item', async () => {
      const contentId = await createTestContent();
      const scheduleId = await createScheduleItem(contentId, new Date());

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedule/${scheduleId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deleted
      const verify = await db
        .selectFrom('schedule')
        .select('id')
        .where('id', '=', scheduleId)
        .executeTakeFirst();
      expect(verify).toBeUndefined();
    });

    it('should return 404 for non-existent schedule item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedule/${crypto.randomUUID()}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/schedule (clear all)', () => {
    it('should clear all schedule items for user', async () => {
      const contentId = await createTestContent();
      await createScheduleItem(contentId, new Date());
      await createScheduleItem(contentId, new Date(Date.now() + 60000));
      await createScheduleItem(contentId, new Date(Date.now() + 120000));

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedule',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify all deleted
      const remaining = await db
        .selectFrom('schedule')
        .select('id')
        .where('user_id', '=', testUserId)
        .execute();
      expect(remaining).toHaveLength(0);
    });

    it('should return success even when no items to clear', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedule',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /api/schedule/date/:date', () => {
    it('should clear schedule items for specific date', async () => {
      const contentId = await createTestContent();
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create items for today
      await createScheduleItem(contentId, new Date(`${todayStr}T10:00:00Z`));
      await createScheduleItem(contentId, new Date(`${todayStr}T14:00:00Z`));
      // Create item for tomorrow
      await createScheduleItem(contentId, tomorrow);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedule/date/${todayStr}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('2');

      // Verify only tomorrow's item remains
      const remaining = await db
        .selectFrom('schedule')
        .select('id')
        .where('user_id', '=', testUserId)
        .execute();
      expect(remaining).toHaveLength(1);
    });

    it('should handle timezone offset when clearing', async () => {
      const contentId = await createTestContent();
      // Create item at 22:00 UTC on Jan 10 (17:00 EST)
      await createScheduleItem(contentId, new Date('2025-01-10T22:00:00Z'));

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/schedule/date/2025-01-10?timezone_offset=-05:00',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/schedule/:id/watched', () => {
    it('should mark schedule item as watched', async () => {
      const contentId = await createTestContent();
      const scheduleId = await createScheduleItem(contentId, new Date());

      const response = await app.inject({
        method: 'POST',
        url: `/api/schedule/${scheduleId}/watched`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify watched status
      const item = await db
        .selectFrom('schedule')
        .select('watched')
        .where('id', '=', scheduleId)
        .executeTakeFirst();
      expect(item?.watched).toBe(true);
    });

    it('should return 404 for non-existent schedule item', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/schedule/${crypto.randomUUID()}/watched`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/schedule/:id/watched', () => {
    it('should unmark schedule item as watched', async () => {
      const contentId = await createTestContent();
      const scheduleId = await createScheduleItem(contentId, new Date(), { watched: true });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedule/${scheduleId}/watched`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify unwatched status
      const item = await db
        .selectFrom('schedule')
        .select('watched')
        .where('id', '=', scheduleId)
        .executeTakeFirst();
      expect(item?.watched).toBe(false);
    });

    it('should return 404 for non-existent schedule item', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/schedule/${crypto.randomUUID()}/watched`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/schedule',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include content details in schedule response', async () => {
      const contentId = await createTestContent('movie');
      await createScheduleItem(contentId, new Date());

      const response = await app.inject({
        method: 'GET',
        url: '/api/schedule',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body[0].title).toBeDefined();
      expect(body[0].content_type).toBe('movie');
      expect(body[0].content_id).toBe(contentId);
    });
  });
});
