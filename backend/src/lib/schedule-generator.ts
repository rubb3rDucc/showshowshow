import { db } from '../db/index.js';

// Helper: Shuffle array (Fisher-Yates algorithm)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper: Parse time string to Date (in UTC to avoid timezone issues)
export function parseTime(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  // Create a new date from the input date's year/month/day, then set hours in UTC
  const result = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));
  return result;
}

// Helper: Add minutes to date
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Helper: Get time slots between start and end time (handles midnight crossover)
export function generateTimeSlots(startTime: string, endTime: string, slotDuration: number = 30): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  // Handle midnight crossover: if end time is before start time, it means next day
  const crossesMidnight = endHour < startHour || (endHour === startHour && endMin < startMin);
  
  while (true) {
    // Check if we've reached the end time
    if (!crossesMidnight) {
      // Normal case: same day
      if (currentHour > endHour || (currentHour === endHour && currentMin >= endMin)) {
        break;
      }
    } else {
      // Midnight crossover: stop when we reach midnight (00:00)
      if (currentHour >= 24 || (currentHour === 0 && currentMin >= endMin)) {
        break;
      }
    }
    
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
    
    currentMin += slotDuration;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
    
    // Handle hour overflow for midnight crossover
    if (currentHour >= 24) {
      if (crossesMidnight && currentHour === 24 && currentMin === 0) {
        // We've reached exactly midnight, add it and stop
        slots.push('00:00');
      }
      break;
    }
  }
  
  return slots;
}

// Get available episodes for scheduling
async function getAvailableEpisodes(
  userId: string,
  showIds: string[],
  includeReruns: boolean,
  rerunFrequency: string
) {
  // Get all episodes for the shows
  let query = db
    .selectFrom('episodes')
    .innerJoin('content', 'episodes.content_id', 'content.id')
    .leftJoin('watch_history', (join) =>
      join
        .onRef('watch_history.content_id', '=', 'episodes.content_id')
        .onRef('watch_history.season', '=', 'episodes.season')
        .onRef('watch_history.episode', '=', 'episodes.episode_number')
        .on('watch_history.user_id', '=', userId)
    )
    .where('content.id', 'in', showIds)
    .select([
      'episodes.id',
      'episodes.content_id',
      'episodes.season',
      'episodes.episode_number',
      'episodes.duration',
      'episodes.air_date',
      'content.default_duration',
      'watch_history.watched_at',
      'watch_history.rewatch_count',
    ]) as any;

  if (!includeReruns) {
    // Only unwatched episodes (where watch_history doesn't exist)
    query = query.where('watch_history.id', 'is', null);
  }

  const episodes = await query.execute();
  console.log(`[Schedule Generator] Found ${episodes.length} episodes for ${showIds.length} shows`);

  type EpisodeWithWatch = typeof episodes[0] & { watched_at: Date | null; rewatch_count: number | null };

  // Filter reruns based on frequency
  if (includeReruns && rerunFrequency !== 'never') {
    const rerunRatio = {
      rarely: 0.1,
      sometimes: 0.3,
      often: 0.5,
    }[rerunFrequency] || 0.1;

    const unwatched = (episodes as EpisodeWithWatch[]).filter((e: EpisodeWithWatch) => !e.watched_at);
    const watched = (episodes as EpisodeWithWatch[]).filter((e: EpisodeWithWatch) => e.watched_at);
    const numReruns = Math.floor(unwatched.length * rerunRatio);
    const selectedReruns = watched
      .sort((a: EpisodeWithWatch, b: EpisodeWithWatch) => (a.watched_at?.getTime() ?? 0) - (b.watched_at?.getTime() ?? 0))
      .slice(0, numReruns);
    return [...unwatched, ...selectedReruns] as any;
  }

  const unwatched = (episodes as EpisodeWithWatch[]).filter((e: EpisodeWithWatch) => !e.watched_at);
  console.log(`[Schedule Generator] Returning ${unwatched.length} unwatched episodes`);
  return unwatched;
}

interface GenerateScheduleOptions {
  userId: string;
  showIds: string[];
  startDate: Date;
  endDate: Date;
  timeSlots: string[];
  maxShowsPerTimeSlot?: number;
  includeReruns?: boolean;
  rerunFrequency?: string;
  rotationType?: 'round_robin' | 'random';
}

// Generate schedule from queue or shows
export async function generateSchedule(options: GenerateScheduleOptions) {
  const {
    userId,
    showIds,
    startDate,
    endDate,
    timeSlots,
    maxShowsPerTimeSlot = 1,
    includeReruns = false,
    rerunFrequency = 'rarely',
    rotationType = 'round_robin',
  } = options;

  // Get content info to separate shows from movies
  const contentItems = await db
    .selectFrom('content')
    .select(['id', 'content_type', 'default_duration', 'title'])
    .where('id', 'in', showIds)
    .execute();

  console.log(`[Schedule Generator] Found ${contentItems.length} content item(s) in database for IDs: ${showIds.join(', ')}`);
  contentItems.forEach((item) => {
    console.log(`[Schedule Generator] Content: ${item.title} (${item.id}) - Type: ${item.content_type}, Duration: ${item.default_duration} min`);
  });

  const shows = contentItems.filter((c) => c.content_type === 'show');
  const movies = contentItems.filter((c) => c.content_type === 'movie');
  const showIdsOnly = shows.map((s) => s.id);
  const movieIds = movies.map((m) => m.id);

  console.log(`[Schedule Generator] Processing ${shows.length} show(s) and ${movies.length} movie(s)`);

  // Handle shows (episodes)
  let episodesByShow = new Map<string, any[]>();
  if (showIdsOnly.length > 0) {
    // Check if episodes exist for these shows
    const episodeCount = await db
      .selectFrom('episodes')
      .innerJoin('content', 'episodes.content_id', 'content.id')
      .where('content.id', 'in', showIdsOnly)
      .select((eb: any) => eb.fn.count('episodes.id').as('count'))
      .executeTakeFirst();

    const totalEpisodes = Number((episodeCount as any)?.count ?? 0);
    console.log(`[Schedule Generator] Total episodes in database: ${totalEpisodes} for ${showIdsOnly.length} show(s)`);

    if (totalEpisodes > 0) {
      // Get available episodes
      const availableEpisodes = await getAvailableEpisodes(userId, showIdsOnly, includeReruns, rerunFrequency);
      console.log(`[Schedule Generator] Available episodes: ${availableEpisodes.length} out of ${totalEpisodes} total`);

      // Group episodes by show for rotation and shuffle them for randomization
      showIdsOnly.forEach((showId) => {
        const showEpisodes = availableEpisodes.filter((e: any) => e.content_id === showId);
        // Shuffle episodes to randomize selection order
        episodesByShow.set(showId, shuffleArray(showEpisodes));
      });
    }
  }

  // Handle movies (single items)
  const moviesByShow = new Map<string, any[]>();
  if (movieIds.length > 0) {
    // Check watch history for movies
    const movieWatchHistory = await db
      .selectFrom('watch_history')
      .select(['content_id', 'watched_at'])
      .where('user_id', '=', userId)
      .where('content_id', 'in', movieIds)
      .where('season', 'is', null)
      .where('episode', 'is', null)
      .execute();

    const watchedMovieIds = new Set(movieWatchHistory.map((w) => w.content_id));

    movieIds.forEach((movieId) => {
      const movie = movies.find((m) => m.id === movieId);
      if (!movie) {
        console.log(`[Schedule Generator] Movie ${movieId} not found in content list`);
        return;
      }

      // Check if movie is watched
      const isWatched = watchedMovieIds.has(movieId);
      console.log(`[Schedule Generator] Movie ${movieId} (${movie.default_duration} min): watched=${isWatched}, includeReruns=${includeReruns}`);

      // Only include unwatched movies (or all if reruns are enabled)
      if (includeReruns || !isWatched) {
        if (!movie.default_duration || movie.default_duration <= 0) {
          console.log(`[Schedule Generator] Skipping movie ${movieId} - invalid duration: ${movie.default_duration}`);
          return;
        }
        moviesByShow.set(movieId, [{
          content_id: movieId,
          season: null,
          episode_number: null,
          duration: movie.default_duration,
          default_duration: movie.default_duration,
        }]);
        console.log(`[Schedule Generator] Added movie ${movieId} to available movies`);
      } else {
        console.log(`[Schedule Generator] Skipping movie ${movieId} - already watched and reruns disabled`);
      }
    });

    console.log(`[Schedule Generator] Available movies: ${moviesByShow.size} out of ${movieIds.length} total`);
  }

  // Check if we have any content to schedule (episodes or movies)
  const totalEpisodes = Array.from(episodesByShow.values()).reduce((sum, eps) => sum + eps.length, 0);
  const totalMovies = moviesByShow.size;
  
  if (totalEpisodes === 0 && totalMovies === 0) {
    console.log('[Schedule Generator] No content available to schedule (no episodes for shows, no available movies)');
    return [];
  }

  const schedule: Array<{
    content_id: string;
    season: number | null;
    episode: number | null;
    scheduled_time: Date;
    duration: number;
  }> = [];

  const timeSlotUsage = new Map<string, number>(); // Track usage per time slot
  let showIndex = 0;
  const episodeIndexes = new Map<string, number>(); // Track episode index per show

  // Initialize episode indexes
  showIds.forEach((showId) => {
    episodeIndexes.set(showId, 0);
  });

  // Parse start and end times to determine if we cross midnight
  const [startHour, startMin] = timeSlots[0]?.split(':').map(Number) ?? [0, 0];
  const lastSlot = timeSlots[timeSlots.length - 1];
  const [endHour, endMin] = lastSlot?.split(':').map(Number) ?? [0, 0];
  const crossesMidnight = endHour < startHour || (endHour === startHour && endMin < startMin);

  // Generate schedule day by day
  // Parse dates as UTC to avoid timezone issues
  const startDateUTC = new Date(startDate);
  const endDateUTC = new Date(endDate);
  
  // Create dates at midnight UTC for the start and end dates
  const currentDate = new Date(Date.UTC(
    startDateUTC.getUTCFullYear(),
    startDateUTC.getUTCMonth(),
    startDateUTC.getUTCDate(),
    0, 0, 0, 0
  ));
  
  const endDateCopy = new Date(Date.UTC(
    endDateUTC.getUTCFullYear(),
    endDateUTC.getUTCMonth(),
    endDateUTC.getUTCDate(),
    23, 59, 59, 999
  ));

  while (currentDate <= endDateCopy) {
    // Generate schedule for this day
    for (const timeSlot of timeSlots) {
      const scheduledTime = parseTime(timeSlot, currentDate);
      
      // If crossing midnight and we're past midnight, move to next day
      if (crossesMidnight && scheduledTime.getUTCHours() < startHour) {
        scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
      }

      // Calculate the actual end time for this day's schedule window
      let dayEndTime: Date;
      if (crossesMidnight) {
        // If crossing midnight, end time is next day at endHour:endMin
        dayEndTime = new Date(Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth(),
          currentDate.getUTCDate() + 1,
          endHour,
          endMin,
          0,
          0
        ));
      } else {
        // Normal case: same day
        dayEndTime = new Date(Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth(),
          currentDate.getUTCDate(),
          endHour,
          endMin,
          0,
          0
        ));
      }
      
      // Get date-only versions for comparison
      const scheduledDateOnly = new Date(Date.UTC(
        scheduledTime.getUTCFullYear(),
        scheduledTime.getUTCMonth(),
        scheduledTime.getUTCDate(),
        0, 0, 0, 0
      ));
      const endDateOnly = new Date(Date.UTC(
        endDateCopy.getUTCFullYear(),
        endDateCopy.getUTCMonth(),
        endDateCopy.getUTCDate(),
        0, 0, 0, 0
      ));
      
      // Don't schedule if it goes beyond the end date entirely
      if (scheduledDateOnly > endDateOnly) {
        break; // We're past the end date
      }
      
      // Don't schedule if scheduled time is at or after the end time for this day
      if (scheduledTime >= dayEndTime) {
        // If we're past the end time and it's the end date, break
        if (scheduledDateOnly.getTime() >= endDateOnly.getTime()) {
          break; // We've reached or passed the end date/time
        }
        continue; // Skip this slot, it's past the end time for this day
      }

      // Check time slot usage (use UTC date string for consistency)
      const dateStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
      const slotKey = `${dateStr}-${timeSlot}`;
      const currentUsage = timeSlotUsage.get(slotKey) ?? 0;
      if (currentUsage >= maxShowsPerTimeSlot) {
        continue; // Skip this slot, already at capacity
      }

      // Get next content in rotation (show or movie)
      let currentContentId: string | undefined;
      if (rotationType === 'round_robin') {
        currentContentId = showIds[showIndex % showIds.length];
        showIndex++;
      } else {
        // Random rotation - check both shows and movies
        const availableContent = showIds.filter((id) => {
          const episodes = episodesByShow.get(id) ?? [];
          const movies = moviesByShow.get(id) ?? [];
          const index = episodeIndexes.get(id) ?? 0;
          return index < episodes.length || movies.length > 0;
        });
        if (availableContent.length === 0) {
          break; // No more content
        }
        currentContentId = availableContent[Math.floor(Math.random() * availableContent.length)];
      }

      if (!currentContentId) {
        continue;
      }

      // Check if it's a movie first
      const movieItems = moviesByShow.get(currentContentId);
      if (movieItems && movieItems.length > 0) {
        // It's a movie - schedule it once
        const movie = movieItems[0];
        const duration = movie.duration ?? 120; // Default to 2 hours for movies

        if (!duration || duration <= 0) {
          console.log(`[Schedule Generator] Skipping movie with invalid duration: ${duration}`);
          moviesByShow.delete(currentContentId); // Remove from available movies
          continue;
        }

        // Check if movie fits in remaining time slots
        const endTime = addMinutes(scheduledTime, duration);

        // Don't schedule if movie doesn't fit in the day's time window
        if (endTime > dayEndTime) {
          continue; // Movie doesn't fit
        }
        
        // Don't schedule if movie end time goes beyond the end date
        const endTimeDateOnly = new Date(Date.UTC(
          endTime.getUTCFullYear(),
          endTime.getUTCMonth(),
          endTime.getUTCDate(),
          0, 0, 0, 0
        ));
        
        if (endTimeDateOnly > endDateOnly) {
          break; // Movie would go beyond the end date
        }

        // Add movie to schedule
        schedule.push({
          content_id: movie.content_id,
          season: null,
          episode: null,
          scheduled_time: scheduledTime,
          duration,
        });

        // Remove movie from available list (only schedule once)
        moviesByShow.delete(currentContentId);
        timeSlotUsage.set(slotKey, currentUsage + 1);
        continue;
      }

      // It's a show - get next episode
      const showEpisodes = episodesByShow.get(currentContentId) ?? [];
      const episodeIndex = episodeIndexes.get(currentContentId) ?? 0;
      if (episodeIndex >= showEpisodes.length) {
        continue; // No more episodes for this show
      }

      const episode = showEpisodes[episodeIndex];
      const duration = episode.duration ?? episode.default_duration ?? 30; // Default to 30 minutes if both are null

      if (!duration || duration <= 0) {
        console.log(`[Schedule Generator] Skipping episode with invalid duration: ${duration}`);
        episodeIndexes.set(currentContentId, episodeIndex + 1);
        continue;
      }

      // Check if episode fits in remaining time slots
      const endTime = addMinutes(scheduledTime, duration);

      // Don't schedule if episode doesn't fit in the day's time window
      if (endTime > dayEndTime) {
        continue; // Episode doesn't fit
      }
      
      // Don't schedule if episode end time goes beyond the end date
      const endTimeDateOnly = new Date(Date.UTC(
        endTime.getUTCFullYear(),
        endTime.getUTCMonth(),
        endTime.getUTCDate(),
        0, 0, 0, 0
      ));
      
      if (endTimeDateOnly > endDateOnly) {
        break; // Episode would go beyond the end date
      }

      // Add to schedule
      schedule.push({
        content_id: episode.content_id,
        season: episode.season,
        episode: episode.episode_number,
        scheduled_time: scheduledTime,
        duration,
      });

      // Update indexes
      episodeIndexes.set(currentContentId, episodeIndex + 1);
      timeSlotUsage.set(slotKey, currentUsage + 1);
    }

    // Move to next day (in UTC)
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  console.log(`[Schedule Generator] Generated ${schedule.length} schedule items`);
  return schedule;
}

// Generate schedule from queue
export async function generateScheduleFromQueue(
  userId: string,
  startDate: Date,
  endDate: Date,
  timeSlots: string[],
  options: Omit<GenerateScheduleOptions, 'userId' | 'showIds' | 'startDate' | 'endDate' | 'timeSlots'> = {}
) {
  // Get shows from queue
  const queueItems = await db
    .selectFrom('queue')
    .select('content_id')
    .where('user_id', '=', userId)
    .orderBy('position', 'asc')
    .execute();

  const showIds = [...new Set(queueItems.map((q: any) => q.content_id))] as string[];
  if (showIds.length === 0) {
    return [];
  }

  return generateSchedule({
    userId,
    showIds,
    startDate,
    endDate,
    timeSlots,
    ...options,
  });
}

// Save generated schedule to database
export async function saveSchedule(
  userId: string,
  scheduleItems: Array<{
    content_id: string;
    season: number | null;
    episode: number | null;
    scheduled_time: Date;
    duration: number;
  }>,
  sourceType: 'manual' | 'auto' | 'block' | 'rotation' = 'auto',
  sourceId: string | null = null
) {
  if (scheduleItems.length === 0) {
    return [];
  }

  const saved = await db
    .insertInto('schedule')
    .values(
      scheduleItems.map((item) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        content_id: item.content_id,
        season: item.season,
        episode: item.episode,
        scheduled_time: item.scheduled_time,
        duration: item.duration,
        source_type: sourceType,
        source_id: sourceId,
        watched: false,
        synced: false,
        created_at: new Date(),
      }))
    )
    .returningAll()
    .execute();

  return saved;
}
