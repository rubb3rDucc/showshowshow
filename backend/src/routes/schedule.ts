import { sql } from 'kysely';
import { db } from '../db/index.js';
import { authenticateClerk } from '../plugins/clerk-auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { FastifyInstance } from 'fastify';

export const scheduleRoutes = async (fastify: FastifyInstance) => {
  // Get user's schedule
  fastify.get('/api/schedule', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { start, end } = request.query as { start?: string; end?: string };

    let query = db
      .selectFrom('schedule')
      .innerJoin('content', 'schedule.content_id', 'content.id')
      .leftJoin('episodes', (join) =>
        join
          .onRef('episodes.content_id', '=', 'schedule.content_id')
          .onRef('episodes.season', '=', 'schedule.season')
          .onRef('episodes.episode_number', '=', 'schedule.episode')
      )
      .select([
        'schedule.id',
        'schedule.scheduled_time',
        'schedule.season',
        'schedule.episode',
        'schedule.duration',
        'schedule.source_type',
        'schedule.source_id',
        'schedule.watched',
        'schedule.timezone_offset',
        'schedule.created_at',
        'content.id as content_id',
        'content.tmdb_id',
        'content.title',
        'content.poster_url',
        'content.content_type',
        'content.rating',
        'episodes.title as episode_title',
        sql<boolean>`
          (
            EXISTS (
              SELECT 1
              FROM watch_history
              WHERE watch_history.user_id = schedule.user_id
                AND watch_history.content_id = schedule.content_id
                AND watch_history.season IS NOT DISTINCT FROM schedule.season
                AND watch_history.episode IS NOT DISTINCT FROM schedule.episode
            )
            OR (
              content.content_type = 'show'
              AND schedule.season IS NOT NULL
              AND schedule.episode IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM library_episode_status
                WHERE library_episode_status.user_id = schedule.user_id
                  AND library_episode_status.content_id = schedule.content_id
                  AND library_episode_status.season = schedule.season
                  AND library_episode_status.episode = schedule.episode
                  AND library_episode_status.status = 'watched'
              )
            )
            OR (
              content.content_type = 'movie'
              AND EXISTS (
                SELECT 1
                FROM user_library
                WHERE user_library.user_id = schedule.user_id
                  AND user_library.content_id = schedule.content_id
                  AND (
                    user_library.status = 'completed'
                    OR user_library.last_watched_at IS NOT NULL
                  )
              )
            )
            OR (
              content.content_type = 'show'
              AND schedule.season IS NULL
              AND schedule.episode IS NULL
              AND EXISTS (
                SELECT 1
                FROM user_library
                WHERE user_library.user_id = schedule.user_id
                  AND user_library.content_id = schedule.content_id
                  AND user_library.last_watched_at IS NOT NULL
              )
            )
          )
        `.as('is_rerun'),
      ])
      .where('schedule.user_id', '=', userId)
      .orderBy('schedule.scheduled_time', 'asc');

    // Filter by date range if provided
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
  fastify.get('/api/schedule/date/:date', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { date } = request.params as { date: string };
    const { timezone_offset } = request.query as { timezone_offset?: string };

    // Parse date string (YYYY-MM-DD)
    const [year, month, day] = date.split('-').map(Number);
    
    // Parse timezone offset (e.g., "-05:00" for EST)
    let offsetMinutes = 0;
    if (timezone_offset) {
      const offsetMatch = timezone_offset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (offsetMatch) {
        const [, sign, hours, minutes] = offsetMatch;
        offsetMinutes = (sign === '-' ? -1 : 1) * (parseInt(hours) * 60 + parseInt(minutes));
      }
    }

    // Create date range in user's local timezone, then convert to UTC
    // For example: Dec 12 midnight EST (-05:00) = Dec 12 05:00 UTC
    const localMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const startDate = new Date(localMidnight - (offsetMinutes * 60 * 1000));
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    fastify.log.info(`Querying schedule for ${date} (timezone ${timezone_offset || 'UTC'}): ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const schedule = await db
      .selectFrom('schedule')
      .innerJoin('content', 'schedule.content_id', 'content.id')
      .leftJoin('episodes', (join) =>
        join
          .onRef('episodes.content_id', '=', 'schedule.content_id')
          .onRef('episodes.season', '=', 'schedule.season')
          .onRef('episodes.episode_number', '=', 'schedule.episode')
      )
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
        'content.title',
        'content.poster_url',
        'content.content_type',
        'content.rating',
        'episodes.title as episode_title',
        sql<boolean>`
          (
            EXISTS (
              SELECT 1
              FROM watch_history
              WHERE watch_history.user_id = schedule.user_id
                AND watch_history.content_id = schedule.content_id
                AND watch_history.season IS NOT DISTINCT FROM schedule.season
                AND watch_history.episode IS NOT DISTINCT FROM schedule.episode
            )
            OR (
              content.content_type = 'show'
              AND schedule.season IS NOT NULL
              AND schedule.episode IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM library_episode_status
                WHERE library_episode_status.user_id = schedule.user_id
                  AND library_episode_status.content_id = schedule.content_id
                  AND library_episode_status.season = schedule.season
                  AND library_episode_status.episode = schedule.episode
                  AND library_episode_status.status = 'watched'
              )
            )
            OR (
              content.content_type = 'movie'
              AND EXISTS (
                SELECT 1
                FROM user_library
                WHERE user_library.user_id = schedule.user_id
                  AND user_library.content_id = schedule.content_id
                  AND (
                    user_library.status = 'completed'
                    OR user_library.last_watched_at IS NOT NULL
                  )
              )
            )
            OR (
              content.content_type = 'show'
              AND schedule.season IS NULL
              AND schedule.episode IS NULL
              AND EXISTS (
                SELECT 1
                FROM user_library
                WHERE user_library.user_id = schedule.user_id
                  AND user_library.content_id = schedule.content_id
                  AND user_library.last_watched_at IS NOT NULL
              )
            )
          )
        `.as('is_rerun'),
      ])
      .where('schedule.user_id', '=', userId)
      .where('schedule.scheduled_time', '>=', startDate)
      .where('schedule.scheduled_time', '<', endDate)
      .orderBy('schedule.scheduled_time', 'asc')
      .execute();

    fastify.log.info(`Found ${schedule.length} schedule items for ${date}`);

    return reply.send(schedule);
  });

  // Create schedule item (manual)
  fastify.post('/api/schedule', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
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

    // Verify content exists
    const content = await db
      .selectFrom('content')
      .select(['id', 'default_duration'])
      .where('id', '=', content_id)
      .executeTakeFirst();

    if (!content) {
      throw new NotFoundError('Content not found');
    }

    // Get duration (from request, episode, or content default)
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

    // Create schedule item
    const scheduleItem = await db
      .insertInto('schedule')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
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

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('schedule_item_created', {
      distinctId: userId,
      properties: {
        content_id,
        scheduled_time: scheduled_time,
        duration: finalDuration,
        source: 'manual',
        season: season ?? null,
        episode: episode ?? null,
      },
    });

    return reply.code(201).send(scheduleItem);
  });

  // Update schedule item (reschedule, mark watched, etc.)
  fastify.put('/api/schedule/:id', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const updates = request.body as { scheduled_time?: string; watched?: boolean };

    // Verify ownership and get existing data
    const existing = await db
      .selectFrom('schedule')
      .select(['id', 'scheduled_time', 'content_id'])
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Schedule item not found');
    }

    // Build update object
    const updateData: any = {};
    const fieldsChanged: string[] = [];
    let oldTime: string | null = null;
    let newTime: string | null = null;

    if (updates.scheduled_time !== undefined) {
      oldTime = existing.scheduled_time.toISOString();
      newTime = updates.scheduled_time;
      updateData.scheduled_time = new Date(updates.scheduled_time);
      fieldsChanged.push('scheduled_time');
    }
    if (updates.watched !== undefined) {
      updateData.watched = updates.watched;
      fieldsChanged.push('watched');
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

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('schedule_item_updated', {
      distinctId: userId,
      properties: {
        schedule_id: id,
        content_id: existing.content_id,
        fields_changed: fieldsChanged,
        old_time: oldTime,
        new_time: newTime,
      },
    });

    return reply.send(updated);
  });

  // Delete schedule item
  fastify.delete('/api/schedule/:id', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    // Verify ownership and get item details
    const existing = await db
      .selectFrom('schedule')
      .select(['id', 'content_id', 'scheduled_time'])
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Schedule item not found');
    }

    await db.deleteFrom('schedule').where('id', '=', id).execute();

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('schedule_item_deleted', {
      distinctId: userId,
      properties: {
        schedule_id: id,
        scheduled_time: existing.scheduled_time.toISOString(),
        content_id: existing.content_id,
      },
    });

    return reply.send({ success: true });
  });

  // Clear all schedule items for user
  fastify.delete('/api/schedule', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;

    // Delete all schedule items for this user
    const result = await db
      .deleteFrom('schedule')
      .where('user_id', '=', userId)
      .execute();

    return reply.send({ 
      success: true, 
      message: `Cleared ${result.length > 0 ? result[0].numDeletedRows : 0} schedule items` 
    });
  });

  // Clear schedule items for a specific date
  fastify.delete('/api/schedule/date/:date', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { date } = request.params as { date: string };
    const { timezone_offset } = request.query as { timezone_offset?: string };

    // Parse date string (YYYY-MM-DD)
    const [year, month, day] = date.split('-').map(Number);
    
    // Parse timezone offset (e.g., "-05:00" for EST)
    let offsetMinutes = 0;
    if (timezone_offset) {
      const offsetMatch = timezone_offset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (offsetMatch) {
        const [, sign, hours, minutes] = offsetMatch;
        offsetMinutes = (sign === '-' ? -1 : 1) * (parseInt(hours) * 60 + parseInt(minutes));
      }
    }

    // Create date range in user's local timezone, then convert to UTC
    const localMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const startDate = new Date(localMidnight - (offsetMinutes * 60 * 1000));
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    // Delete all schedule items for this user on this date
    const deleted = await db
      .deleteFrom('schedule')
      .where('user_id', '=', userId)
      .where('scheduled_time', '>=', startDate)
      .where('scheduled_time', '<', endDate)
      .execute();

    const count = deleted.length > 0 ? Number(deleted[0].numDeletedRows) : 0;

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('schedule_cleared', {
      distinctId: userId,
      properties: {
        date,
        items_cleared: count,
        timezone_offset: timezone_offset || null,
      },
    });

    return reply.send({ 
      success: true, 
      message: `Cleared ${count} schedule item${count !== 1 ? 's' : ''} for ${date}` 
    });
  });

  // Mark schedule item as watched
  fastify.post('/api/schedule/:id/watched', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    // Get schedule item
    const scheduleItem = await db
      .selectFrom('schedule')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!scheduleItem) {
      throw new NotFoundError('Schedule item not found');
    }

    const watchedAt = new Date();

    // Mark as watched in transaction
    await db.transaction().execute(async (trx) => {
      // Update schedule
      await trx
        .updateTable('schedule')
        .set({ watched: true })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .execute();

      const content = await trx
        .selectFrom('content')
        .select(['id', 'content_type'])
        .where('id', '=', scheduleItem.content_id)
        .executeTakeFirst();

      if (!content) {
        throw new NotFoundError('Content not found');
      }

      const existingLibrary = await trx
        .selectFrom('user_library')
        .select(['id', 'status', 'started_at'])
        .where('user_id', '=', userId)
        .where('content_id', '=', scheduleItem.content_id)
        .executeTakeFirst();

      if (!existingLibrary) {
        const isMovie = content.content_type === 'movie';
        const now = watchedAt;
        await trx
          .insertInto('user_library')
          .values({
            id: crypto.randomUUID(),
            user_id: userId,
            content_id: scheduleItem.content_id,
            status: isMovie ? 'completed' : 'watching',
            current_season: 1,
            current_episode: 1,
            started_at: isMovie ? now : now,
            completed_at: isMovie ? now : null,
            last_watched_at: now,
            episodes_watched: 0,
            created_at: now,
            updated_at: now,
          })
          .execute();
      }

      if (content.content_type === 'movie') {
        const now = watchedAt;
        await trx
          .updateTable('user_library')
          .set({
            status: 'completed',
            completed_at: now,
            last_watched_at: now,
            updated_at: now,
            started_at: existingLibrary?.started_at ?? now,
          })
          .where('user_id', '=', userId)
          .where('content_id', '=', scheduleItem.content_id)
          .execute();
      } else if (scheduleItem.season !== null && scheduleItem.episode !== null) {
        await trx
          .insertInto('library_episode_status')
          .values({
            id: crypto.randomUUID(),
            user_id: userId,
            content_id: scheduleItem.content_id,
            season: scheduleItem.season,
            episode: scheduleItem.episode,
            status: 'watched',
            watched_at: watchedAt,
            created_at: new Date(),
          })
          .onConflict((oc) => oc
            .columns(['user_id', 'content_id', 'season', 'episode'])
            .doUpdateSet({
              status: 'watched',
              watched_at: watchedAt,
            })
          )
          .execute();

        const watchedCount = await trx
          .selectFrom('library_episode_status')
          .select(sql<number>`COUNT(*)::int`.as('count'))
          .where('user_id', '=', userId)
          .where('content_id', '=', scheduleItem.content_id)
          .where('status', '=', 'watched')
          .executeTakeFirst();

        const episodesWatched = watchedCount?.count || 0;
        const now = watchedAt;
        const updates: {
          episodes_watched: number;
          last_watched_at: Date;
          updated_at: Date;
          status?: 'watching' | 'completed' | 'dropped' | 'plan_to_watch';
        } = {
          episodes_watched: episodesWatched,
          last_watched_at: now,
          updated_at: now,
        };

        if (existingLibrary?.status === 'plan_to_watch') {
          updates.status = 'watching';
        }

        await trx
          .updateTable('user_library')
          .set(updates)
          .where('user_id', '=', userId)
          .where('content_id', '=', scheduleItem.content_id)
          .execute();
      } else {
        const now = watchedAt;
        const updates: {
          last_watched_at: Date;
          updated_at: Date;
          status?: 'watching' | 'completed' | 'dropped' | 'plan_to_watch';
        } = {
          last_watched_at: now,
          updated_at: now,
        };

        if (existingLibrary?.status === 'plan_to_watch') {
          updates.status = 'watching';
        }

        await trx
          .updateTable('user_library')
          .set(updates)
          .where('user_id', '=', userId)
          .where('content_id', '=', scheduleItem.content_id)
          .execute();
      }

      // Add/update watch history
      const existingHistory = await trx
        .selectFrom('watch_history')
        .selectAll()
        .where('user_id', '=', userId)
        .where('content_id', '=', scheduleItem.content_id)
        .where('season', '=', scheduleItem.season ?? null)
        .where('episode', '=', scheduleItem.episode ?? null)
        .executeTakeFirst();

      if (existingHistory) {
        // Increment rewatch count
        await trx
          .updateTable('watch_history')
          .set({
            rewatch_count: existingHistory.rewatch_count + 1,
            watched_at: watchedAt,
            synced: false,
          })
          .where('id', '=', existingHistory.id)
          .execute();
      } else {
        // Create new watch history entry
        await trx
          .insertInto('watch_history')
          .values({
            id: crypto.randomUUID(),
            user_id: userId,
            content_id: scheduleItem.content_id,
            season: scheduleItem.season ?? null,
            episode: scheduleItem.episode ?? null,
            watched_at: watchedAt,
            rewatch_count: 0,
            synced: false,
            created_at: new Date(),
          })
          .execute();
      }
    });

    return reply.send({ success: true });
  });

  // Unmark schedule item as watched
  fastify.delete('/api/schedule/:id/watched', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    // Get schedule item
    const scheduleItem = await db
      .selectFrom('schedule')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!scheduleItem) {
      throw new NotFoundError('Schedule item not found');
    }

    // Unmark as watched in transaction
    await db.transaction().execute(async (trx) => {
      // Update schedule
      await trx
        .updateTable('schedule')
        .set({ watched: false })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .execute();

      const content = await trx
        .selectFrom('content')
        .select(['id', 'content_type'])
        .where('id', '=', scheduleItem.content_id)
        .executeTakeFirst();

      if (!content) {
        throw new NotFoundError('Content not found');
      }

      const existingLibrary = await trx
        .selectFrom('user_library')
        .select(['id'])
        .where('user_id', '=', userId)
        .where('content_id', '=', scheduleItem.content_id)
        .executeTakeFirst();

      if (existingLibrary) {
        if (content.content_type === 'movie') {
          await trx
            .updateTable('user_library')
            .set({
              status: 'plan_to_watch',
              completed_at: null,
              last_watched_at: null,
              updated_at: new Date(),
            })
            .where('user_id', '=', userId)
            .where('content_id', '=', scheduleItem.content_id)
            .execute();
        } else if (scheduleItem.season !== null && scheduleItem.episode !== null) {
          await trx
            .insertInto('library_episode_status')
            .values({
              id: crypto.randomUUID(),
              user_id: userId,
              content_id: scheduleItem.content_id,
              season: scheduleItem.season,
              episode: scheduleItem.episode,
              status: 'unwatched',
              watched_at: null,
              created_at: new Date(),
            })
            .onConflict((oc) => oc
              .columns(['user_id', 'content_id', 'season', 'episode'])
              .doUpdateSet({
                status: 'unwatched',
                watched_at: null,
              })
            )
            .execute();

          const watchedCount = await trx
            .selectFrom('library_episode_status')
            .select(sql<number>`COUNT(*)::int`.as('count'))
            .where('user_id', '=', userId)
            .where('content_id', '=', scheduleItem.content_id)
            .where('status', '=', 'watched')
            .executeTakeFirst();

          const lastWatched = await trx
            .selectFrom('library_episode_status')
            .select(sql<Date | null>`MAX(watched_at)`.as('last_watched_at'))
            .where('user_id', '=', userId)
            .where('content_id', '=', scheduleItem.content_id)
            .where('status', '=', 'watched')
            .executeTakeFirst();

          const episodesWatched = watchedCount?.count || 0;
          const lastWatchedAt = lastWatched?.last_watched_at ?? null;

          await trx
            .updateTable('user_library')
            .set({
              episodes_watched: episodesWatched,
              last_watched_at: lastWatchedAt,
              updated_at: new Date(),
            })
            .where('user_id', '=', userId)
            .where('content_id', '=', scheduleItem.content_id)
            .execute();
        } else {
          const lastWatched = await trx
            .selectFrom('library_episode_status')
            .select(sql<Date | null>`MAX(watched_at)`.as('last_watched_at'))
            .where('user_id', '=', userId)
            .where('content_id', '=', scheduleItem.content_id)
            .where('status', '=', 'watched')
            .executeTakeFirst();

          const lastWatchedAt = lastWatched?.last_watched_at ?? null;

          await trx
            .updateTable('user_library')
            .set({
              last_watched_at: lastWatchedAt,
              updated_at: new Date(),
            })
            .where('user_id', '=', userId)
            .where('content_id', '=', scheduleItem.content_id)
            .execute();
        }
      }

      // Remove from watch history
      await trx
        .deleteFrom('watch_history')
        .where('user_id', '=', userId)
        .where('content_id', '=', scheduleItem.content_id)
        .where('season', '=', scheduleItem.season ?? null)
        .where('episode', '=', scheduleItem.episode ?? null)
        .execute();
    });

    return reply.send({ success: true, watched_at: null });
  });
};
