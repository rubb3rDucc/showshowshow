import { db } from '../db/index.js';
import { authenticate } from '../plugins/auth.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';

export const libraryRoutes = async (fastify: FastifyInstance) => {
  // Get user's library items
  fastify.get('/api/library', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { status, type, search } = request.query as { 
      status?: string; 
      type?: 'show' | 'movie' | 'all'; 
      search?: string;
    };

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

    // Filter by status
    if (status && status !== 'all') {
      query = query.where('user_library.status', '=', status as any);
    }

    // Filter by type
    if (type && type !== 'all') {
      query = query.where('content.content_type', '=', type);
    }

    // Search by title
    if (search && search.trim().length > 0) {
      query = query.where('content.title', 'ilike', `%${search.trim()}%`);
    }

    const libraryItems = await query
      .orderBy('user_library.updated_at', 'desc')
      .execute();

    // Calculate progress for each item
    const itemsWithProgress = libraryItems.map((item) => {
      const totalEpisodes = item.number_of_episodes || 0;
      const episodesWatched = item.episodes_watched || 0;
      const percentage = totalEpisodes > 0 
        ? Math.round((episodesWatched / totalEpisodes) * 100) 
        : 0;

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
          episodes_watched: episodesWatched,
          total_episodes: totalEpisodes,
          percentage,
        },
      };
    });

    return reply.send(itemsWithProgress);
  });

  // Get library statistics
  fastify.get('/api/library/stats', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;

    const stats = await db
      .selectFrom('user_library')
      .innerJoin('content', 'user_library.content_id', 'content.id')
      .select([
        sql<number>`COUNT(*)::int`.as('total'),
        sql<number>`COUNT(*) FILTER (WHERE user_library.status = 'watching')::int`.as('watching'),
        sql<number>`COUNT(*) FILTER (WHERE user_library.status = 'completed')::int`.as('completed'),
        sql<number>`COUNT(*) FILTER (WHERE user_library.status = 'dropped')::int`.as('dropped'),
        sql<number>`COUNT(*) FILTER (WHERE user_library.status = 'plan_to_watch')::int`.as('plan_to_watch'),
        sql<number>`COUNT(*) FILTER (WHERE content.content_type = 'show')::int`.as('shows'),
        sql<number>`COUNT(*) FILTER (WHERE content.content_type = 'movie')::int`.as('movies'),
        sql<number>`COALESCE(SUM(user_library.episodes_watched), 0)::int`.as('total_episodes_watched'),
      ])
      .where('user_library.user_id', '=', userId)
      .executeTakeFirst();

    return reply.send({
      total: stats?.total || 0,
      watching: stats?.watching || 0,
      completed: stats?.completed || 0,
      dropped: stats?.dropped || 0,
      plan_to_watch: stats?.plan_to_watch || 0,
      shows: stats?.shows || 0,
      movies: stats?.movies || 0,
      total_episodes_watched: stats?.total_episodes_watched || 0,
    });
  });

  // Get detailed library statistics
  fastify.get('/api/library/stats/detailed', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;

    // Get shows in progress
    const showsInProgress = await db
      .selectFrom('user_library')
      .innerJoin('content', 'user_library.content_id', 'content.id')
      .select([
        'user_library.id',
        'user_library.content_id',
        'content.title',
        'content.poster_url',
        'content.number_of_episodes',
        'user_library.episodes_watched',
      ])
      .where('user_library.user_id', '=', userId)
      .where('user_library.status', '=', 'watching')
      .where('content.content_type', '=', 'show')
      .orderBy('user_library.last_watched_at', 'desc')
      .limit(10)
      .execute();

    const progressItems = showsInProgress.map(item => {
      const totalEpisodes = item.number_of_episodes || 0;
      const episodesWatched = item.episodes_watched || 0;
      const percentage = totalEpisodes > 0 
        ? Math.round((episodesWatched / totalEpisodes) * 100) 
        : 0;

      return {
        id: item.id,
        content_id: item.content_id,
        title: item.title,
        poster_url: item.poster_url,
        episodes_watched: episodesWatched,
        total_episodes: totalEpisodes,
        percentage,
      };
    });

    // Get recent activity (last 10 items watched/completed)
    const recentActivity = await db
      .selectFrom('user_library')
      .innerJoin('content', 'user_library.content_id', 'content.id')
      .select([
        'user_library.id',
        'user_library.content_id',
        'content.title',
        'content.poster_url',
        'content.content_type',
        'user_library.status',
        'user_library.last_watched_at',
        'user_library.completed_at',
        'user_library.updated_at',
      ])
      .where('user_library.user_id', '=', userId)
      .where((eb) => eb.or([
        eb('user_library.last_watched_at', 'is not', null),
        eb('user_library.completed_at', 'is not', null),
      ]))
      .orderBy(
        sql`COALESCE(user_library.last_watched_at, user_library.completed_at)`,
        'desc'
      )
      .limit(10)
      .execute();

    // Calculate viewing insights
    const totalItems = await db
      .selectFrom('user_library')
      .select(sql<number>`COUNT(*)::int`.as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const completedItems = await db
      .selectFrom('user_library')
      .select(sql<number>`COUNT(*)::int`.as('count'))
      .where('user_id', '=', userId)
      .where('status', '=', 'completed')
      .executeTakeFirst();

    const completionRate = (totalItems?.count || 0) > 0
      ? Math.round(((completedItems?.count || 0) / (totalItems?.count || 0)) * 100)
      : 0;

    // Get most watched genres (if we have genre data)
    const genreStats = await db
      .selectFrom('user_library')
      .innerJoin('content', 'user_library.content_id', 'content.id')
      .select([
        'content.genres',
        sql<number>`COUNT(*)::int`.as('count'),
      ])
      .where('user_library.user_id', '=', userId)
      .where('user_library.status', 'in', ['watching', 'completed'])
      .groupBy('content.genres')
      .orderBy('count', 'desc')
      .limit(5)
      .execute();

    // Calculate total episodes watched
    const episodeStats = await db
      .selectFrom('user_library')
      .select(sql<number>`COALESCE(SUM(episodes_watched), 0)::int`.as('total'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    // Estimate watch time (average 45 min per episode)
    const totalEpisodesWatched = episodeStats?.total || 0;
    const estimatedMinutes = totalEpisodesWatched * 45;
    const estimatedHours = Math.round(estimatedMinutes / 60);

    return reply.send({
      shows_in_progress: progressItems,
      recent_activity: recentActivity,
      insights: {
        completion_rate: completionRate,
        total_watch_time_hours: estimatedHours,
        total_episodes_watched: totalEpisodesWatched,
        most_watched_genres: genreStats,
      },
    });
  });

  // Get a single library item by ID
  fastify.get('/api/library/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    const libraryItem = await db
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
      .where('user_library.id', '=', id)
      .where('user_library.user_id', '=', userId)
      .executeTakeFirst();

    if (!libraryItem) {
      throw new NotFoundError('Library item not found');
    }

    const totalEpisodes = libraryItem.number_of_episodes || 0;
    const episodesWatched = libraryItem.episodes_watched || 0;
    const percentage = totalEpisodes > 0 
      ? Math.round((episodesWatched / totalEpisodes) * 100) 
      : 0;

    return reply.send({
      ...libraryItem,
      content: {
        id: libraryItem.content_id,
        title: libraryItem.title,
        poster_url: libraryItem.poster_url,
        content_type: libraryItem.content_type,
        number_of_episodes: libraryItem.number_of_episodes,
        number_of_seasons: libraryItem.number_of_seasons,
      },
      progress: {
        episodes_watched: episodesWatched,
        total_episodes: totalEpisodes,
        percentage,
      },
    });
  });

  // Check if content is in library
  fastify.get('/api/library/check/:contentId', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { contentId } = request.params as { contentId: string };

    const libraryItem = await db
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
      .where('user_library.content_id', '=', contentId)
      .where('user_library.user_id', '=', userId)
      .executeTakeFirst();

    if (!libraryItem) {
      return reply.send({ in_library: false });
    }

    const totalEpisodes = libraryItem.number_of_episodes || 0;
    const episodesWatched = libraryItem.episodes_watched || 0;
    const percentage = totalEpisodes > 0 
      ? Math.round((episodesWatched / totalEpisodes) * 100) 
      : 0;

    return reply.send({
      in_library: true,
      library_item: {
        ...libraryItem,
        content: {
          id: libraryItem.content_id,
          title: libraryItem.title,
          poster_url: libraryItem.poster_url,
          content_type: libraryItem.content_type,
          number_of_episodes: libraryItem.number_of_episodes,
          number_of_seasons: libraryItem.number_of_seasons,
        },
        progress: {
          episodes_watched: episodesWatched,
          total_episodes: totalEpisodes,
          percentage,
        },
      },
    });
  });

  // Add content to library
  fastify.post('/api/library', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { content_id, status = 'plan_to_watch' } = request.body as { 
      content_id: string; 
      status?: 'watching' | 'completed' | 'dropped' | 'plan_to_watch';
    };

    if (!content_id) {
      throw new ValidationError('content_id is required');
    }

    // Verify content exists
    const content = await db
      .selectFrom('content')
      .select(['id', 'content_type', 'number_of_episodes'])
      .where('id', '=', content_id)
      .executeTakeFirst();

    if (!content) {
      throw new NotFoundError('Content not found');
    }

    // Check if already in library
    const existing = await db
      .selectFrom('user_library')
      .select(['id'])
      .where('user_id', '=', userId)
      .where('content_id', '=', content_id)
      .executeTakeFirst();

    if (existing) {
      // Track duplicate attempt
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('library_item_already_exists', {
        distinctId: userId,
        properties: {
          content_id,
          error_type: 'duplicate',
        },
      });

      throw new ValidationError('Content is already in library');
    }

    // Set started_at if status is 'watching'
    const startedAt = status === 'watching' ? new Date() : null;

    // Insert library item
    const libraryItem = await db
      .insertInto('user_library')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        content_id,
        status,
        current_season: 1,
        current_episode: 1,
        started_at: startedAt,
        episodes_watched: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Get full library item with content
    const fullItem = await db
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
      .where('user_library.id', '=', libraryItem.id)
      .executeTakeFirstOrThrow();

    const totalEpisodes = fullItem.number_of_episodes || 0;
    const episodesWatched = fullItem.episodes_watched || 0;
    const percentage = totalEpisodes > 0 
      ? Math.round((episodesWatched / totalEpisodes) * 100) 
      : 0;

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('item_added_to_library', {
      distinctId: userId,
      properties: {
        content_id,
        content_type: content.content_type,
        status,
        source: 'api', // Could be 'search' or 'queue' if we track that
      },
    });

    return reply.code(201).send({
      ...fullItem,
      content: {
        id: fullItem.content_id,
        title: fullItem.title,
        poster_url: fullItem.poster_url,
        content_type: fullItem.content_type,
        number_of_episodes: fullItem.number_of_episodes,
        number_of_seasons: fullItem.number_of_seasons,
      },
      progress: {
        episodes_watched: episodesWatched,
        total_episodes: totalEpisodes,
        percentage,
      },
    });
  });

  // Update library item
  fastify.patch('/api/library/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const { 
      status, 
      current_season, 
      current_episode, 
      score, 
      notes 
    } = request.body as { 
      status?: 'watching' | 'completed' | 'dropped' | 'plan_to_watch';
      current_season?: number;
      current_episode?: number;
      score?: number | null;
      notes?: string | null;
    };

    // Verify library item exists and belongs to user
    const existing = await db
      .selectFrom('user_library')
      .select(['id', 'status', 'started_at', 'completed_at', 'score'])
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Library item not found');
    }

    // Validate score if provided
    if (score !== undefined && score !== null) {
      if (score < 1 || score > 10) {
        throw new ValidationError('Score must be between 1 and 10');
      }
    }

    // Validate notes length if provided
    if (notes !== undefined && notes !== null && notes.length > 1000) {
      throw new ValidationError('Notes must be 1000 characters or less');
    }

    // Prepare update object
    const updates: any = {
      updated_at: new Date(),
    };

    if (status !== undefined) {
      updates.status = status;
      
      // Set started_at if changing to 'watching' and not already set
      if (status === 'watching' && !existing.started_at) {
        updates.started_at = new Date();
      }
      
      // Set completed_at if changing to 'completed'
      if (status === 'completed') {
        updates.completed_at = new Date();
        updates.last_watched_at = new Date();
      }
    }

    if (current_season !== undefined) {
      updates.current_season = current_season;
    }

    if (current_episode !== undefined) {
      updates.current_episode = current_episode;
    }

    if (score !== undefined) {
      updates.score = score;
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    // Track which fields changed
    const fieldsChanged: string[] = [];
    if (status !== undefined && status !== existing.status) {
      fieldsChanged.push('status');
    }
    if (current_season !== undefined) fieldsChanged.push('current_season');
    if (current_episode !== undefined) fieldsChanged.push('current_episode');
    if (score !== undefined) fieldsChanged.push('score');
    if (notes !== undefined) fieldsChanged.push('notes');

    // Update library item
    await db
      .updateTable('user_library')
      .set(updates)
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .execute();

    // Get updated library item with content
    const updatedItem = await db
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
      .where('user_library.id', '=', id)
      .executeTakeFirstOrThrow();

    const totalEpisodes = updatedItem.number_of_episodes || 0;
    const episodesWatched = updatedItem.episodes_watched || 0;
    const percentage = totalEpisodes > 0 
      ? Math.round((episodesWatched / totalEpisodes) * 100) 
      : 0;

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('library_item_updated', {
      distinctId: userId,
      properties: {
        content_id: updatedItem.content_id,
        fields_changed: fieldsChanged,
        status_change: status !== undefined && status !== existing.status ? { from: existing.status, to: status } : null,
        score_change: score !== undefined ? { from: existing.score, to: score } : null,
      },
    });

    return reply.send({
      ...updatedItem,
      content: {
        id: updatedItem.content_id,
        title: updatedItem.title,
        poster_url: updatedItem.poster_url,
        content_type: updatedItem.content_type,
        number_of_episodes: updatedItem.number_of_episodes,
        number_of_seasons: updatedItem.number_of_seasons,
      },
      progress: {
        episodes_watched: episodesWatched,
        total_episodes: totalEpisodes,
        percentage,
      },
    });
  });

  // Remove item from library
  fastify.delete('/api/library/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    // Get item details before deletion
    const itemToDelete = await db
      .selectFrom('user_library')
      .innerJoin('content', 'user_library.content_id', 'content.id')
      .select(['user_library.content_id', 'content.content_type'])
      .where('user_library.id', '=', id)
      .where('user_library.user_id', '=', userId)
      .executeTakeFirst();

    if (!itemToDelete) {
      throw new NotFoundError('Library item not found');
    }

    const deleted = await db
      .deleteFrom('user_library')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .execute();

    // Get library size after deletion
    const librarySizeAfter = await db
      .selectFrom('user_library')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('library_item_removed', {
      distinctId: userId,
      properties: {
        content_id: itemToDelete.content_id,
        content_type: itemToDelete.content_type,
        library_size_after: Number(librarySizeAfter?.count || 0),
      },
    });

    return reply.send({ success: true });
  });

  // Get episode statuses for a content item
  fastify.get('/api/library/:contentId/episodes', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { contentId } = request.params as { contentId: string };

    const episodeStatuses = await db
      .selectFrom('library_episode_status')
      .select([
        'season',
        'episode',
        'status',
        'watched_at',
      ])
      .where('user_id', '=', userId)
      .where('content_id', '=', contentId)
      .orderBy('season', 'asc')
      .orderBy('episode', 'asc')
      .execute();

    return reply.send(episodeStatuses);
  });

  // Mark an episode as watched/unwatched/skipped
  fastify.post('/api/library/:contentId/episodes/mark', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { contentId } = request.params as { contentId: string };
    const { season, episode, status } = request.body as { 
      season: number; 
      episode: number; 
      status: 'watched' | 'unwatched' | 'skipped';
    };

    if (!season || !episode) {
      // Track error
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('episode_mark_failed', {
        distinctId: userId,
        properties: {
          content_id: contentId,
          error_type: 'validation_error',
          missing_field: !season ? 'season' : 'episode',
        },
      });

      throw new ValidationError('season and episode are required');
    }

    // Upsert episode status
    await db
      .insertInto('library_episode_status')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        content_id: contentId,
        season,
        episode,
        status,
        watched_at: status === 'watched' ? new Date() : null,
        created_at: new Date(),
      })
      .onConflict((oc) => oc
        .columns(['user_id', 'content_id', 'season', 'episode'])
        .doUpdateSet({
          status,
          watched_at: status === 'watched' ? new Date() : null,
        })
      )
      .execute();

    // Recalculate episodes_watched count
    const watchedCount = await db
      .selectFrom('library_episode_status')
      .select(sql<number>`COUNT(*)::int`.as('count'))
      .where('user_id', '=', userId)
      .where('content_id', '=', contentId)
      .where('status', '=', 'watched')
      .executeTakeFirst();

    const episodesWatched = watchedCount?.count || 0;

    // Update library item
    await db
      .updateTable('user_library')
      .set({
        episodes_watched: episodesWatched,
        last_watched_at: status === 'watched' ? new Date() : undefined,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .where('content_id', '=', contentId)
      .execute();

    // Get updated library item
    const libraryItem = await db
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
      .where('user_library.user_id', '=', userId)
      .where('user_library.content_id', '=', contentId)
      .executeTakeFirst();

    if (!libraryItem) {
      throw new NotFoundError('Library item not found');
    }

    const totalEpisodes = libraryItem.number_of_episodes || 0;
    const percentage = totalEpisodes > 0 
      ? Math.round((episodesWatched / totalEpisodes) * 100) 
      : 0;

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('episode_marked_watched', {
      distinctId: userId,
      properties: {
        content_id: contentId,
        season,
        episode,
        status, // watched/unwatched/skipped
        total_episodes_watched: episodesWatched,
        total_episodes: totalEpisodes,
      },
    });

    return reply.send({
      success: true,
      library_item: {
        ...libraryItem,
        content: {
          id: libraryItem.content_id,
          title: libraryItem.title,
          poster_url: libraryItem.poster_url,
          content_type: libraryItem.content_type,
          number_of_episodes: libraryItem.number_of_episodes,
          number_of_seasons: libraryItem.number_of_seasons,
        },
        progress: {
          episodes_watched: episodesWatched,
          total_episodes: totalEpisodes,
          percentage,
        },
      },
    });
  });

  // Mark all episodes in a season
  fastify.post('/api/library/:contentId/episodes/mark-season', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { contentId } = request.params as { contentId: string };
    const { season, status } = request.body as { 
      season: number; 
      status: 'watched' | 'unwatched';
    };

    if (!season) {
      throw new ValidationError('season is required');
    }

    // Get all episodes for this season
    const episodes = await db
      .selectFrom('episodes')
      .select(['episode_number'])
      .where('content_id', '=', contentId)
      .where('season', '=', season)
      .execute();

    if (episodes.length === 0) {
      // Track error
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('season_mark_failed', {
        distinctId: userId,
        properties: {
          content_id: contentId,
          season,
          error_type: 'no_episodes_found',
        },
      });

      throw new NotFoundError('No episodes found for this season');
    }

    // Mark all episodes
    const watchedAt = status === 'watched' ? new Date() : null;
    for (const ep of episodes) {
      await db
        .insertInto('library_episode_status')
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          content_id: contentId,
          season,
          episode: ep.episode_number,
          status: status === 'watched' ? 'watched' : 'unwatched',
          watched_at: watchedAt,
          created_at: new Date(),
        })
        .onConflict((oc) => oc
          .columns(['user_id', 'content_id', 'season', 'episode'])
          .doUpdateSet({
            status: status === 'watched' ? 'watched' : 'unwatched',
            watched_at: watchedAt,
          })
        )
        .execute();
    }

    // Recalculate episodes_watched count
    const watchedCount = await db
      .selectFrom('library_episode_status')
      .select(sql<number>`COUNT(*)::int`.as('count'))
      .where('user_id', '=', userId)
      .where('content_id', '=', contentId)
      .where('status', '=', 'watched')
      .executeTakeFirst();

    const episodesWatched = watchedCount?.count || 0;

    // Update library item
    await db
      .updateTable('user_library')
      .set({
        episodes_watched: episodesWatched,
        last_watched_at: status === 'watched' ? new Date() : undefined,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .where('content_id', '=', contentId)
      .execute();

    // Get content details for tracking
    const content = await db
      .selectFrom('content')
      .select(['number_of_episodes', 'number_of_seasons'])
      .where('id', '=', contentId)
      .executeTakeFirst();

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('season_marked_watched', {
      distinctId: userId,
      properties: {
        content_id: contentId,
        season,
        episodes_count: episodes.length,
        status, // watched/unwatched
        total_episodes_watched: episodesWatched,
        total_episodes: content?.number_of_episodes || 0,
      },
    });

    return reply.send({ 
      success: true, 
      episodes_marked: episodes.length 
    });
  });

  // Mark all episodes as watched/unwatched
  fastify.post('/api/library/:contentId/episodes/mark-all', { preHandler: authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const { contentId } = request.params as { contentId: string };
    const { status } = request.body as { 
      status: 'watched' | 'unwatched';
    };

    // Get all episodes for this content
    const episodes = await db
      .selectFrom('episodes')
      .select(['season', 'episode_number'])
      .where('content_id', '=', contentId)
      .execute();

    if (episodes.length === 0) {
      // Track error
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('all_episodes_mark_failed', {
        distinctId: userId,
        properties: {
          content_id: contentId,
          error_type: 'no_episodes_found',
        },
      });

      throw new NotFoundError('No episodes found for this content');
    }

    // Mark all episodes
    const watchedAt = status === 'watched' ? new Date() : null;
    for (const ep of episodes) {
      await db
        .insertInto('library_episode_status')
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          content_id: contentId,
          season: ep.season,
          episode: ep.episode_number,
          status: status === 'watched' ? 'watched' : 'unwatched',
          watched_at: watchedAt,
          created_at: new Date(),
        })
        .onConflict((oc) => oc
          .columns(['user_id', 'content_id', 'season', 'episode'])
          .doUpdateSet({
            status: status === 'watched' ? 'watched' : 'unwatched',
            watched_at: watchedAt,
          })
        )
        .execute();
    }

    // Recalculate episodes_watched count
    const watchedCount = await db
      .selectFrom('library_episode_status')
      .select(sql<number>`COUNT(*)::int`.as('count'))
      .where('user_id', '=', userId)
      .where('content_id', '=', contentId)
      .where('status', '=', 'watched')
      .executeTakeFirst();

    const episodesWatched = watchedCount?.count || 0;

    // Update library item
    await db
      .updateTable('user_library')
      .set({
        episodes_watched: episodesWatched,
        last_watched_at: status === 'watched' ? new Date() : undefined,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .where('content_id', '=', contentId)
      .execute();

    // Get content details for tracking
    const content = await db
      .selectFrom('content')
      .select(['number_of_episodes', 'number_of_seasons'])
      .where('id', '=', contentId)
      .executeTakeFirst();

    // Track event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('all_episodes_marked_watched', {
      distinctId: userId,
      properties: {
        content_id: contentId,
        total_episodes: episodes.length,
        total_seasons: content?.number_of_seasons || 0,
        status, // watched/unwatched
        total_episodes_watched: episodesWatched,
      },
    });

    return reply.send({ 
      success: true, 
      episodes_marked: episodes.length 
    });
  });
};

