import { db } from '../db/index.js';
import { authenticate } from '../plugins/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { FastifyInstance } from 'fastify';

export const queueRoutes = async (fastify: FastifyInstance) => {
  // Get user's queue
  fastify.get('/api/queue', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;

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
  fastify.post('/api/queue', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { content_id, season, episode } = request.body as { content_id?: string; season?: number; episode?: number };

    if (!content_id) {
      throw new ValidationError('content_id is required');
    }

    // Verify content exists and get content type
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
    const existing = await db
      .selectFrom('queue')
      .select('id')
      .where('user_id', '=', userId)
      .where('content_id', '=', content_id)
      .where('season', '=', season ?? null)
      .where('episode', '=', episode ?? null)
      .executeTakeFirst();

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

    // If it's a show, trigger background episode fetch (don't block the response)
    if (content.content_type === 'show') {
      // Fire and forget - don't wait for completion
      setImmediate(async () => {
        try {
          const { ensureEpisodesFetched } = await import('../lib/schedule-generator.js');
          console.log(`[Queue] Background: Auto-fetching episodes for show ${content_id}...`);
          await ensureEpisodesFetched([content_id]);
          console.log(`[Queue] Background: ✅ Episodes fetched for show ${content_id}`);
        } catch (error) {
          console.error(`[Queue] Background: ❌ Failed to fetch episodes for show ${content_id}:`, error);
          // Don't throw - this is background work, failures are logged but don't affect the user
        }
      });
    }

    return reply.code(201).send(queueItem);
  });

  // Remove item from queue
  fastify.delete('/api/queue/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    // Verify ownership
    const queueItem = await db
      .selectFrom('queue')
      .select('id')
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

    // Update positions sequentially
    for (let i = 0; i < remainingItems.length; i++) {
      await db
        .updateTable('queue')
        .set({ position: i })
        .where('id', '=', remainingItems[i].id)
        .execute();
    }

    return reply.send({ success: true });
  });

  // Reorder queue
  fastify.put('/api/queue/reorder', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
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

    // Update positions in transaction
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < item_ids.length; i++) {
        await trx
          .updateTable('queue')
          .set({ position: i })
          .where('id', '=', item_ids[i])
          .execute();
      }
    });

    return reply.send({ success: true });
  });

  // Clear queue
  fastify.delete('/api/queue', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    await db.deleteFrom('queue').where('user_id', '=', userId).execute();

    return reply.send({ success: true });
  });
};

