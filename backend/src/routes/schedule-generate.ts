import { db } from '../db/index.js';
import { authenticateClerk } from '../plugins/clerk-auth.js';
import { generateSchedule, generateScheduleFromQueue, saveSchedule, generateTimeSlots } from '../lib/schedule-generator.js';
import { ValidationError } from '../lib/errors.js';
import type { FastifyInstance } from 'fastify';

export const scheduleGenerateRoutes = async (fastify: FastifyInstance) => {
  // Auto-generate schedule from queue
  fastify.post('/api/schedule/generate/queue', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const {
      start_date,
      end_date,
      start_time = '18:00',
      end_time = '00:00',
      time_slot_duration,
      timezone_offset,
      max_shows_per_time_slot = 1,
      include_reruns = false,
      rerun_frequency = 'rarely',
      rotation_type = 'round_robin',
      episode_filters,
    } = request.body as {
      start_date?: string;
      end_date?: string;
      start_time?: string;
      end_time?: string;
      time_slot_duration?: number;
      timezone_offset?: string; // Timezone offset like "-05:00" (EST) or "+00:00" (UTC)
      max_shows_per_time_slot?: number;
      include_reruns?: boolean;
      rerun_frequency?: string;
      rotation_type?: 'round_robin' | 'random' | 'round_robin_double';
      episode_filters?: Record<string, {
        mode: 'all' | 'include' | 'exclude';
        seasons?: number[];
        episodes?: Array<{ season: number; episode: number }>;
      }>;
    };

    if (!start_date || !end_date) {
      throw new ValidationError('start_date and end_date are required');
    }

    fastify.log.info(`Received dates: start_date='${start_date}', end_date='${end_date}'`);

    // Parse dates and normalize to UTC midnight for comparison
    const startDate = new Date(start_date + 'T00:00:00.000Z');
    const endDate = new Date(end_date + 'T00:00:00.000Z');

    fastify.log.info(`Parsed dates: startDate=${startDate.toISOString()}, endDate=${endDate.toISOString()}`);
    fastify.log.info(`Comparison: startDate > endDate = ${startDate > endDate}, startDate.getTime()=${startDate.getTime()}, endDate.getTime()=${endDate.getTime()}`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    // Allow same-day scheduling - only reject if start is after end
    if (startDate > endDate) {
      throw new ValidationError('start_date must be before or equal to end_date');
    }

    // Get queue content IDs
    const queueItems = await db
      .selectFrom('queue')
      .select('content_id')
      .where('user_id', '=', userId)
      .orderBy('position', 'asc')
      .execute();

    const contentIds = [...new Set(queueItems.map((q: any) => q.content_id))] as string[];

    // Ensure episodes are fetched for shows (fast cache check, only fetches if needed)
    if (contentIds.length > 0) {
      const { ensureEpisodesFetched } = await import('../lib/schedule-generator.js');
      fastify.log.info('Ensuring episodes are fetched for shows in queue...');
      await ensureEpisodesFetched(contentIds);
    }

    // Log the received times
    fastify.log.info(`Received times: start_time='${start_time}', end_time='${end_time}', timezone_offset='${timezone_offset}'`);

    // Calculate optimal time slot duration if not provided
    let calculatedTimeSlotDuration = time_slot_duration;
    if (!calculatedTimeSlotDuration && contentIds.length > 0) {
      const { calculateOptimalTimeSlotDuration } = await import('../lib/schedule-generator.js');
      calculatedTimeSlotDuration = await calculateOptimalTimeSlotDuration(contentIds);
      fastify.log.info(`Auto-calculated time slot duration: ${calculatedTimeSlotDuration} minutes`);
    } else if (!calculatedTimeSlotDuration) {
      calculatedTimeSlotDuration = 30; // Default fallback
    }

    // Generate time slots
    fastify.log.info(`Generating time slots from ${start_time} to ${end_time} with ${calculatedTimeSlotDuration} minute duration`);
    const timeSlots = generateTimeSlots(start_time, end_time, calculatedTimeSlotDuration);
    fastify.log.info(`Generated ${timeSlots.length} time slots: first=${timeSlots[0]}, last=${timeSlots[timeSlots.length - 1]}`);
    if (timeSlots.length === 0) {
      throw new ValidationError('Invalid time range');
    }

    // Track generation start time
    const generationStartTime = Date.now();

    // Generate schedule
    const scheduleItems = await generateScheduleFromQueue(userId, startDate, endDate, timeSlots, {
      timezoneOffset: timezone_offset, // Use provided timezone or default to UTC
      maxShowsPerTimeSlot: max_shows_per_time_slot,
      includeReruns: include_reruns,
      rerunFrequency: rerun_frequency,
      rotationType: rotation_type,
      episodeFilters: episode_filters,
    });

    const generationTime = Date.now() - generationStartTime;

    if (scheduleItems.length === 0) {
      // Track failed generation
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('schedule_generation_failed', {
        distinctId: userId,
        properties: {
          start_date,
          end_date,
          queue_size: contentIds.length,
          error_type: 'no_content_available',
          generation_time_ms: generationTime,
        },
      });

      return reply.code(200).send({
        count: 0,
        schedule: [],
        message:
          'No content available to schedule. For shows, make sure episodes have been fetched. For movies, ensure they are not already watched (unless reruns are enabled).',
      });
    }

    // Save to database
    const saved = await saveSchedule(userId, scheduleItems, 'auto');

    // Track successful generation
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('schedule_generated', {
      distinctId: userId,
      properties: {
        start_date,
        end_date,
        items_scheduled: saved.length,
        items_skipped: scheduleItems.length - saved.length, // In case some failed to save
        queue_size: contentIds.length,
        time_slot_duration: calculatedTimeSlotDuration,
        mode: 'auto',
        generation_time_ms: generationTime,
        rotation_type: rotation_type,
        include_reruns: include_reruns,
      },
    });

    return reply.code(201).send({
      count: saved.length,
      schedule: saved,
    });
  });

  // Auto-generate schedule from specific shows
  fastify.post('/api/schedule/generate/shows', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const userId = request.user.userId;
    const {
      show_ids,
      start_date,
      end_date,
      start_time = '18:00',
      end_time = '00:00',
      time_slot_duration = 30,
      max_shows_per_time_slot = 1,
      include_reruns = false,
      rerun_frequency = 'rarely',
      rotation_type = 'round_robin',
      episode_filters,
    } = request.body as {
      show_ids?: string[];
      start_date?: string;
      end_date?: string;
      start_time?: string;
      end_time?: string;
      time_slot_duration?: number;
      max_shows_per_time_slot?: number;
      include_reruns?: boolean;
      rerun_frequency?: string;
      rotation_type?: 'round_robin' | 'random' | 'round_robin_double';
      episode_filters?: Record<string, {
        mode: 'all' | 'include' | 'exclude';
        seasons?: number[];
        episodes?: Array<{ season: number; episode: number }>;
      }>;
    };

    if (!show_ids || !Array.isArray(show_ids) || show_ids.length === 0) {
      throw new ValidationError('show_ids must be a non-empty array');
    }

    if (!start_date || !end_date) {
      throw new ValidationError('start_date and end_date are required');
    }

    // Verify shows exist
    const shows = await db
      .selectFrom('content')
      .select('id')
      .where('id', 'in', show_ids)
      .execute();

    if (shows.length !== show_ids.length) {
      throw new ValidationError('Some shows not found');
    }

    // Parse dates and normalize to UTC midnight for comparison
    const startDate = new Date(start_date + 'T00:00:00.000Z');
    const endDate = new Date(end_date + 'T00:00:00.000Z');

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    // Allow same-day scheduling - only reject if start is after end
    if (startDate > endDate) {
      throw new ValidationError('start_date must be before or equal to end_date');
    }

    // Generate time slots
    const timeSlots = generateTimeSlots(start_time, end_time, time_slot_duration);
    if (timeSlots.length === 0) {
      throw new ValidationError('Invalid time range');
    }

    // Track generation start time
    const generationStartTime = Date.now();

    // Generate schedule
    const scheduleItems = await generateSchedule({
      userId,
      showIds: show_ids,
      startDate,
      endDate,
      timeSlots,
      maxShowsPerTimeSlot: max_shows_per_time_slot,
      includeReruns: include_reruns,
      rerunFrequency: rerun_frequency,
      rotationType: rotation_type,
      episodeFilters: episode_filters,
    });

    const generationTime = Date.now() - generationStartTime;

    if (scheduleItems.length === 0) {
      // Track failed generation
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('schedule_generation_failed', {
        distinctId: userId,
        properties: {
          start_date,
          end_date,
          show_count: show_ids.length,
          error_type: 'no_episodes_available',
          generation_time_ms: generationTime,
        },
      });

      return reply.code(200).send({
        count: 0,
        schedule: [],
        message: 'No episodes available to schedule. Make sure episodes have been fetched for these shows.',
      });
    }

    // Save to database
    const saved = await saveSchedule(userId, scheduleItems, 'auto');

    // Track successful generation
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('schedule_generated', {
      distinctId: userId,
      properties: {
        start_date,
        end_date,
        items_scheduled: saved.length,
        items_skipped: scheduleItems.length - saved.length,
        show_count: show_ids.length,
        time_slot_duration,
        mode: 'auto',
        generation_time_ms: generationTime,
        rotation_type: rotation_type,
        include_reruns: include_reruns,
      },
    });

    return reply.code(201).send({
      count: saved.length,
      schedule: saved,
    });
  });
};
