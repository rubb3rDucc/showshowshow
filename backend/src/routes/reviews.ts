import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { requireActiveSubscription } from '../plugins/entitlements.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { validateReviewBody } from '../lib/review-body-validation.js';

const MAX_TITLE_LENGTH = 500;

export const reviewsRoutes = async (fastify: FastifyInstance) => {
  // List the current user's reviews
  fastify.get('/api/reviews', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const userId = request.user!.userId;

    const reviews = await db
      .selectFrom('reviews')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    return reply.send(reviews);
  });

  // Get a single review
  fastify.get('/api/reviews/:id', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const review = await db
      .selectFrom('reviews')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    return reply.send(review);
  });

  // Create a new (empty) review
  fastify.post('/api/reviews', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const userId = request.user!.userId;

    const now = new Date();
    const review = await db
      .insertInto('reviews')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        title: null,
        body: null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(review);
  });

  // Update a review (partial)
  fastify.patch('/api/reviews/:id', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { title, body } = request.body as { title?: unknown; body?: unknown };

    const updates: { title?: string | null; body?: Record<string, any> | null } = {};

    if (title !== undefined) {
      if (title !== null && typeof title !== 'string') {
        throw new ValidationError('title must be a string or null');
      }
      if (typeof title === 'string' && title.length > MAX_TITLE_LENGTH) {
        throw new ValidationError(`title exceeds ${MAX_TITLE_LENGTH} character limit`);
      }
      updates.title = title;
    }

    if (body !== undefined) {
      validateReviewBody(body);
      updates.body = body as Record<string, any> | null;
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('no fields to update');
    }

    const review = await db
      .updateTable('reviews')
      .set(updates)
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    return reply.send(review);
  });

  // Delete a review
  fastify.delete('/api/reviews/:id', { preHandler: requireActiveSubscription }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const result = await db
      .deleteFrom('reviews')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundError('Review not found');
    }

    return reply.send({ success: true });
  });
};