import { db } from '../db/index.js';
import { authenticateClerk } from '../plugins/clerk-auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';

/**
 * User "lists" (collections) of content. Items reference `content.id` (the app's
 * single cross-source identity), so TMDB and Jikan/anime titles are handled
 * uniformly. Open to any signed-in user (authenticateClerk) — the paywall stays
 * on scheduling, not on organizing.
 */
export const listsRoutes = async (fastify: FastifyInstance) => {
  // List the user's lists, each with an item count + a few posters for the overview.
  fastify.get('/api/lists', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;

    const lists = await db
      .selectFrom('lists')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'asc')
      .execute();

    if (lists.length === 0) return reply.send([]);

    // Pull ordered items (with posters) for all of the user's lists in one query.
    const rows = await db
      .selectFrom('list_items')
      .innerJoin('content', 'list_items.content_id', 'content.id')
      .select(['list_items.list_id', 'list_items.position', 'content.poster_url'])
      .where(
        'list_items.list_id',
        'in',
        lists.map((l) => l.id)
      )
      .orderBy('list_items.position', 'asc')
      .execute();

    const byList = new Map<string, { count: number; posters: string[] }>();
    for (const l of lists) byList.set(l.id, { count: 0, posters: [] });
    for (const r of rows) {
      const entry = byList.get(r.list_id)!;
      entry.count += 1;
      if (r.poster_url && entry.posters.length < 8) entry.posters.push(r.poster_url);
    }

    return reply.send(
      lists.map((l) => ({
        ...l,
        item_count: byList.get(l.id)!.count,
        posters: byList.get(l.id)!.posters,
      }))
    );
  });

  // Get one list with its ordered items (joined to content).
  fastify.get('/api/lists/:id', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    const list = await db
      .selectFrom('lists')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!list) throw new NotFoundError('List not found');

    const items = await db
      .selectFrom('list_items')
      .innerJoin('content', 'list_items.content_id', 'content.id')
      .select([
        'list_items.position',
        'content.id as content_id',
        'content.title',
        'content.poster_url',
        'content.content_type',
        'content.data_source',
        'content.tmdb_id',
        'content.mal_id',
      ])
      .where('list_items.list_id', '=', id)
      .orderBy('list_items.position', 'asc')
      .execute();

    return reply.send({ ...list, items });
  });

  // Create a list.
  fastify.post('/api/lists', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;
    const { name, description, ranked } = request.body as {
      name?: string;
      description?: string | null;
      ranked?: boolean;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('name is required');
    }

    const list = await db
      .insertInto('lists')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
        ranked: ranked ?? false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send({ ...list, item_count: 0, posters: [] });
  });

  // Update a list (name / description / ranked).
  fastify.patch('/api/lists/:id', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const { name, description, ranked } = request.body as {
      name?: string;
      description?: string | null;
      ranked?: boolean;
    };

    const updates: { name?: string; description?: string | null; ranked?: boolean; updated_at: Date } = {
      updated_at: new Date(),
    };
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) throw new ValidationError('name must be a non-empty string');
      updates.name = name.trim();
    }
    if (description !== undefined) updates.description = description?.trim() || null;
    if (ranked !== undefined) {
      if (typeof ranked !== 'boolean') throw new ValidationError('ranked must be a boolean');
      updates.ranked = ranked;
    }

    const list = await db
      .updateTable('lists')
      .set(updates)
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();

    if (!list) throw new NotFoundError('List not found');
    return reply.send(list);
  });

  // Delete a list (items cascade).
  fastify.delete('/api/lists/:id', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    const result = await db
      .deleteFrom('lists')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!result.numDeletedRows) throw new NotFoundError('List not found');
    return reply.send({ success: true });
  });

  // Verify the list belongs to the user; throws NotFoundError otherwise.
  const requireOwnedList = async (id: string, userId: string) => {
    const list = await db
      .selectFrom('lists')
      .select('id')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!list) throw new NotFoundError('List not found');
  };

  // Add items (by content_id) to a list. Skips ids that don't exist or are already present.
  fastify.post('/api/lists/:id/items', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const { content_ids } = request.body as { content_ids?: string[] };

    if (!Array.isArray(content_ids) || content_ids.length === 0) {
      throw new ValidationError('content_ids must be a non-empty array');
    }

    await requireOwnedList(id, userId);

    // Keep only ids that exist in content and aren't already on the list.
    const requested = [...new Set(content_ids)];
    const existingContent = await db
      .selectFrom('content')
      .select('id')
      .where('id', 'in', requested)
      .execute();
    const validIds = new Set(existingContent.map((c) => c.id));

    const already = await db
      .selectFrom('list_items')
      .select('content_id')
      .where('list_id', '=', id)
      .execute();
    const alreadySet = new Set(already.map((r) => r.content_id));

    const toAdd = requested.filter((cid) => validIds.has(cid) && !alreadySet.has(cid));
    if (toAdd.length === 0) return reply.send({ added: 0 });

    const maxPosition = await db
      .selectFrom('list_items')
      .select((eb) => eb.fn.max('position').as('max'))
      .where('list_id', '=', id)
      .executeTakeFirst();
    let next = (maxPosition?.max ?? -1) + 1;

    await db
      .insertInto('list_items')
      .values(
        toAdd.map((cid) => ({
          id: crypto.randomUUID(),
          list_id: id,
          content_id: cid,
          position: next++,
          created_at: new Date(),
        }))
      )
      .execute();

    return reply.code(201).send({ added: toAdd.length });
  });

  // Remove an item (by content_id) and re-pack remaining positions.
  fastify.delete('/api/lists/:id/items/:content_id', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;
    const { id, content_id } = request.params as { id: string; content_id: string };

    await requireOwnedList(id, userId);

    const item = await db
      .selectFrom('list_items')
      .select('id')
      .where('list_id', '=', id)
      .where('content_id', '=', content_id)
      .executeTakeFirst();
    if (!item) throw new NotFoundError('Item not found');

    await db.deleteFrom('list_items').where('id', '=', item.id).execute();

    const remaining = await db
      .selectFrom('list_items')
      .select(['id', 'position'])
      .where('list_id', '=', id)
      .orderBy('position', 'asc')
      .execute();

    if (remaining.length > 0) {
      const caseExpr = remaining.map((r, i) => `WHEN '${r.id}' THEN ${i}`).join(' ');
      const ids = remaining.map((r) => `'${r.id}'`).join(', ');
      await sql`
        UPDATE list_items
        SET position = CASE id ${sql.raw(caseExpr)} END
        WHERE id IN (${sql.raw(ids)})
      `.execute(db);
    }

    return reply.send({ success: true });
  });

  // Reorder a list's items by an ordered array of content_ids.
  fastify.put('/api/lists/:id/items/reorder', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const { content_ids } = request.body as { content_ids?: string[] };

    if (!Array.isArray(content_ids) || content_ids.length === 0) {
      throw new ValidationError('content_ids must be a non-empty array');
    }

    await requireOwnedList(id, userId);

    const items = await db
      .selectFrom('list_items')
      .select('content_id')
      .where('list_id', '=', id)
      .execute();
    const owned = new Set(items.map((r) => r.content_id));
    if (content_ids.length !== owned.size || !content_ids.every((cid) => owned.has(cid))) {
      throw new ValidationError('content_ids must match the list exactly');
    }

    const caseExpr = content_ids.map((cid, i) => `WHEN '${cid}' THEN ${i}`).join(' ');
    const ids = content_ids.map((cid) => `'${cid}'`).join(', ');
    await sql`
      UPDATE list_items
      SET position = CASE content_id ${sql.raw(caseExpr)} END
      WHERE list_id = ${id} AND content_id IN (${sql.raw(ids)})
    `.execute(db);

    return reply.send({ success: true });
  });
};
