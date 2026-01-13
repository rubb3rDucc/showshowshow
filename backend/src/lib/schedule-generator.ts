import { db } from '../db/index.js';

// Helper: Limit concurrency of async operations
// Processes tasks in batches to avoid overwhelming connection pool
export async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    const batchResults = await Promise.allSettled(
      batch.map(t => t())
    );
    // Collect successful results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }
  }
  return results;
}

// Helper: Shuffle array (Fisher-Yates algorithm)
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper: Parse time string to Date (treating time as UTC)
// timeStr: "22:00" (in 24-hour format)
// date: Date object for the date (in UTC)
// timezoneOffset: not used, kept for compatibility
export function parseTime(timeStr: string, date: Date, timezoneOffset: string = '+00:00'): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Validate timezone offset format
  const offsetMatch = timezoneOffset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!offsetMatch) {
    // Invalid timezone offset - fall back to UTC
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0
    ));
  }
  
  // Parse timezone offset (e.g., "-05:00" for EST, "+02:00" for CEST)
  const [, sign, offsetHours, offsetMinutes] = offsetMatch;
  const offsetTotalMinutes = (sign === '-' ? -1 : 1) * (parseInt(offsetHours) * 60 + parseInt(offsetMinutes));
  
  // Create a date in the user's local timezone
  // For example, if user says "13:00" in EST (UTC-5), this creates 2025-12-12T13:00:00 in EST
  const localDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));
  
  // Convert to UTC by subtracting the timezone offset
  // For EST (UTC-5 / -05:00), offsetTotalMinutes = -300 minutes
  // To convert EST to UTC, we subtract the offset: UTC = EST - (-300) = EST + 300 minutes
  const utcTime = localDate.getTime() - (offsetTotalMinutes * 60 * 1000);
  
  return new Date(utcTime);
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
export type EpisodeFilterRule = {
  mode: 'all' | 'include' | 'exclude';
  seasons?: number[];
  episodes?: Array<{ season: number; episode: number }>;
};

export function applyEpisodeFilters<T extends { content_id: string; season: number; episode_number: number }>(
  episodes: T[],
  episodeFilters?: Record<string, EpisodeFilterRule>
): T[] {
  if (!episodeFilters) return episodes;

  return episodes.filter((episode) => {
    const rule = episodeFilters[episode.content_id];
    if (!rule || rule.mode === 'all') return true;

    const seasonMatch = rule.seasons?.includes(episode.season) ?? false;
    const episodeMatch = rule.episodes?.some(
      (item) => item.season === episode.season && item.episode === episode.episode_number
    ) ?? false;
    const hasSelections = (rule.seasons?.length ?? 0) > 0 || (rule.episodes?.length ?? 0) > 0;
    if (!hasSelections) return true;

    if (rule.mode === 'include') {
      return seasonMatch || episodeMatch;
    }

    if (rule.mode === 'exclude') {
      return !(seasonMatch || episodeMatch);
    }

    return true;
  });
}

async function getAvailableEpisodes(
  userId: string,
  showIds: string[],
  includeReruns: boolean,
  rerunFrequency: string,
  episodeFilters?: Record<string, EpisodeFilterRule>
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

  const episodes = applyEpisodeFilters(await query.execute(), episodeFilters);

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
  return unwatched;
}

interface GenerateScheduleOptions {
  userId: string;
  showIds: string[];
  startDate: Date;
  endDate: Date;
  timeSlots: string[];
  timezoneOffset?: string; // Timezone offset in format like "-05:00" (EST) or "+00:00" (UTC)
  maxShowsPerTimeSlot?: number;
  includeReruns?: boolean;
  rerunFrequency?: string;
  rotationType?: 'round_robin' | 'random' | 'round_robin_double';
  episodeFilters?: Record<string, EpisodeFilterRule>;
}

// Generate schedule from queue or shows
export async function generateSchedule(options: GenerateScheduleOptions) {
  const {
    userId,
    showIds,
    startDate,
    endDate,
    timeSlots,
    timezoneOffset = '+00:00', // Default to UTC if not provided
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

  const shows = contentItems.filter((c) => c.content_type === 'show');
  const movies = contentItems.filter((c) => c.content_type === 'movie');
  const showIdsOnly = shows.map((s) => s.id);
  const movieIds = movies.map((m) => m.id);

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

    if (totalEpisodes > 0) {
      // Get available episodes
      const availableEpisodes = await getAvailableEpisodes(
        userId,
        showIdsOnly,
        includeReruns,
        rerunFrequency,
        options.episodeFilters
      );

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
        return;
      }

      // Check if movie is watched
      const isWatched = watchedMovieIds.has(movieId);

      // Only include unwatched movies (or all if reruns are enabled)
      if (includeReruns || !isWatched) {
        if (!movie.default_duration || movie.default_duration <= 0) {
          return;
        }
        moviesByShow.set(movieId, [{
          content_id: movieId,
          season: null,
          episode_number: null,
          duration: movie.default_duration,
          default_duration: movie.default_duration,
        }]);
      }
    });
  }

  // Check if we have any content to schedule (episodes or movies)
  const totalEpisodes = Array.from(episodesByShow.values()).reduce((sum, eps) => sum + eps.length, 0);
  const totalMovies = moviesByShow.size;

  if (totalEpisodes === 0 && totalMovies === 0) {
    return [];
  }

  const schedule: Array<{
    content_id: string;
    season: number | null;
    episode: number | null;
    scheduled_time: Date;
    duration: number;
    timezone_offset: string;
  }> = [];

  const timeSlotUsage = new Map<string, number>(); // Track usage per time slot
  let showIndex = 0;
  const episodeIndexes = new Map<string, number>(); // Track episode index per show
  const episodesScheduledFromCurrentShow = new Map<string, number>(); // Track episodes scheduled from current show in current cycle

  // Initialize episode indexes
  showIds.forEach((showId) => {
    episodeIndexes.set(showId, 0);
    episodesScheduledFromCurrentShow.set(showId, 0);
  });

  // Parse start and end times to determine if we cross midnight
  const [startHour, startMin] = timeSlots[0]?.split(':').map(Number) ?? [0, 0];
  const lastSlot = timeSlots[timeSlots.length - 1];
  const [endHour, endMin] = lastSlot?.split(':').map(Number) ?? [0, 0];
  const crossesMidnight = endHour < startHour || (endHour === startHour && endMin < startMin);
  
  // Calculate slot duration from first two slots (to know how long after last slot the end time is)
  let slotDurationMinutes = 30; // Default
  if (timeSlots.length >= 2) {
    const [firstHour, firstMin] = timeSlots[0].split(':').map(Number);
    const [secondHour, secondMin] = timeSlots[1].split(':').map(Number);
    slotDurationMinutes = (secondHour * 60 + secondMin) - (firstHour * 60 + firstMin);
  }

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

  // Track the last scheduled end time to prevent overlaps
  let lastScheduledEndTime: Date | null = null;

  while (currentDate <= endDateCopy) {
    // Calculate the actual start time for this day's schedule window
    // Use parseTime to properly convert from user's timezone to UTC
    const dayStartTime = parseTime(timeSlots[0], currentDate, timezoneOffset);

    // Calculate the actual end time for this day's schedule window
    // The end time is the last slot + slot duration (e.g., 22:45 + 15 min = 23:00)
    const [lastHour, lastMin] = lastSlot.split(':').map(Number);
    const actualEndHour = Math.floor((lastMin + slotDurationMinutes) / 60) + lastHour;
    const actualEndMin = (lastMin + slotDurationMinutes) % 60;
    const endTimeStr = `${String(actualEndHour % 24).padStart(2, '0')}:${String(actualEndMin).padStart(2, '0')}`;

    let dayEndTime: Date;
    if (crossesMidnight) {
      // If crossing midnight, end time is next day
      const nextDay = new Date(currentDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      dayEndTime = parseTime(endTimeStr, actualEndHour >= 24 ? nextDay : currentDate, timezoneOffset);
    } else if (actualEndHour >= 24) {
      // If end time goes past midnight (even if start doesn't)
      const nextDay = new Date(currentDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      dayEndTime = parseTime(endTimeStr, nextDay, timezoneOffset);
    } else {
      // Normal case: same day
      dayEndTime = parseTime(endTimeStr, currentDate, timezoneOffset);
    }

    // Reset lastScheduledEndTime for each new day
    lastScheduledEndTime = null;

    // Generate schedule for this day
    for (const timeSlot of timeSlots) {
      const scheduledTime = parseTime(timeSlot, currentDate, timezoneOffset);
      
      // If the scheduled time ends up before the day's start time after timezone conversion,
      // it means it crossed into the next UTC day, so move it forward
      if (scheduledTime < dayStartTime) {
        scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
      }

      // After adjustment, check if it's still before start or after end
      if (scheduledTime < dayStartTime || scheduledTime >= dayEndTime) {
        continue;
      }

      // Skip this time slot if it overlaps with previously scheduled content
      if (lastScheduledEndTime && scheduledTime < lastScheduledEndTime) {
        continue;
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
      if (rotationType === 'round_robin' || rotationType === 'round_robin_double') {
        const episodesPerShow = rotationType === 'round_robin_double' ? 2 : 1;

        // Try to find next available content in round-robin order
        let attempts = 0;
        while (attempts < showIds.length) {
          const candidateId = showIds[showIndex % showIds.length];
          const scheduledFromCandidate = episodesScheduledFromCurrentShow.get(candidateId) ?? 0;

          // Check if this content has available episodes or is a movie
          const episodes = episodesByShow.get(candidateId) ?? [];
          const movies = moviesByShow.get(candidateId) ?? [];
          const episodeIndex = episodeIndexes.get(candidateId) ?? 0;

          // If we've scheduled enough episodes from this show, move to next show
          if (scheduledFromCandidate >= episodesPerShow) {
            episodesScheduledFromCurrentShow.set(candidateId, 0); // Reset counter
            showIndex++;
            attempts++;
            continue;
          }

          // Check if this content has available content
          if (episodeIndex < episodes.length || movies.length > 0) {
            currentContentId = candidateId;
            break;
          }

          // No more content for this show, move to next
          episodesScheduledFromCurrentShow.set(candidateId, 0); // Reset counter
          showIndex++;
          attempts++;
        }

        // If we tried all shows and none have content, break out of time slot loop
        if (!currentContentId) {
          break; // No more content available
        }
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
          moviesByShow.delete(currentContentId); // Remove from available movies
          continue;
        }

        // Check if movie fits in remaining time slots
        const endTime = addMinutes(scheduledTime, duration);

        // Don't schedule if movie doesn't fit in the day's time window
        if (endTime > dayEndTime) {
          continue; // Movie doesn't fit
        }

        // Add movie to schedule
        schedule.push({
          content_id: movie.content_id,
          season: null,
          episode: null,
          scheduled_time: scheduledTime,
          duration,
          timezone_offset: timezoneOffset,
        });

        // Update last scheduled end time to prevent overlaps
        lastScheduledEndTime = endTime;

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
        episodeIndexes.set(currentContentId, episodeIndex + 1);
        continue;
      }

      // Check if episode fits in remaining time slots
      const endTime = addMinutes(scheduledTime, duration);

      // Don't schedule if episode doesn't fit in the day's time window
      if (endTime > dayEndTime) {
        continue; // Episode doesn't fit
      }

      // Add to schedule
      schedule.push({
        content_id: episode.content_id,
        season: episode.season,
        episode: episode.episode_number,
        scheduled_time: scheduledTime,
        duration,
        timezone_offset: timezoneOffset,
      });

      // Update last scheduled end time to prevent overlaps
      lastScheduledEndTime = endTime;

      // Update indexes
      episodeIndexes.set(currentContentId, episodeIndex + 1);
      timeSlotUsage.set(slotKey, currentUsage + 1);

      // Increment counter for round-robin tracking
      if (rotationType === 'round_robin' || rotationType === 'round_robin_double') {
        const currentCount = episodesScheduledFromCurrentShow.get(currentContentId) ?? 0;
        episodesScheduledFromCurrentShow.set(currentContentId, currentCount + 1);
      }
    }

    // Move to next day (in UTC)
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return schedule;
}

// Calculate optimal time slot duration based on content durations
export async function calculateOptimalTimeSlotDuration(contentIds: string[]): Promise<number> {
  if (contentIds.length === 0) {
    return 30; // Default to 30 minutes if no content
  }

  // Get all content durations
  const content = await db
    .selectFrom('content')
    .select(['id', 'default_duration', 'content_type'])
    .where('id', 'in', contentIds)
    .execute();

  const shows = content.filter(c => c.content_type === 'show');
  const movies = content.filter(c => c.content_type === 'movie');

  // If we have shows, get their episode durations
  let episodeDurations: number[] = [];
  if (shows.length > 0) {
    const showIds = shows.map(s => s.id);
    const episodes = await db
      .selectFrom('episodes')
      .select(['duration'])
      .where('content_id', 'in', showIds)
      .where('duration', 'is not', null)
      .execute();

    episodeDurations = episodes
      .map(e => e.duration)
      .filter((d): d is number => d !== null && d > 0);

    // If no episode durations, fall back to show default durations
    if (episodeDurations.length === 0) {
      episodeDurations = shows
        .map(s => s.default_duration)
        .filter((d): d is number => d !== null && d > 0);
    }
  }

  // Find the most common duration (mode) or shortest if all are different
  let targetDuration: number;
  if (episodeDurations.length > 0) {
    // Calculate mode (most common duration)
    const durationCounts = episodeDurations.reduce((acc, dur) => {
      acc[dur] = (acc[dur] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const sortedDurations = Object.entries(durationCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by frequency
      .map(([dur]) => Number(dur));

    targetDuration = sortedDurations[0];
  } else if (movies.length > 0) {
    // If only movies, use their average duration divided by 4 (for granularity)
    const movieDurations = movies
      .map(m => m.default_duration)
      .filter((d): d is number => d !== null && d > 0);

    const avgMovieDuration = movieDurations.reduce((sum, d) => sum + d, 0) / movieDurations.length;
    targetDuration = Math.floor(avgMovieDuration / 4); // Divide by 4 for more granular slots
  } else {
    targetDuration = 30; // Fallback
  }

  // Round up to nearest multiple of 15
  const slotDuration = Math.max(15, Math.ceil(targetDuration / 15) * 15);

  return slotDuration;
}

// Auto-fetch episodes for shows that don't have them yet (optimized with fast cache check)
export async function ensureEpisodesFetched(showIds: string[]): Promise<void> {
  if (showIds.length === 0) return;

  // Get content info to identify shows
  const contentItems = await db
    .selectFrom('content')
    .select(['id', 'tmdb_id', 'mal_id', 'data_source', 'content_type', 'title', 'number_of_seasons', 'number_of_episodes', 'default_duration'])
    .where('id', 'in', showIds)
    .where('content_type', '=', 'show')
    .execute();

  const shows = contentItems.filter(c => c.content_type === 'show');

  if (shows.length === 0) return;

  // Fast cache check for all shows in parallel (DB queries are fast)
  const cacheChecks = await Promise.all(
    shows.map(async (show) => {
      // Get both count and unique seasons in one query
      const episodes = await db
        .selectFrom('episodes')
        .select(['season'])
        .where('content_id', '=', show.id)
        .execute();

      const cachedCount = episodes.length;
      const cachedSeasons = new Set(episodes.map(e => e.season));
      const expectedSeasons = show.number_of_seasons || 0;
      const expectedEpisodes = show.number_of_episodes || 0;

      // Check if we have all seasons
      const hasAllSeasons = expectedSeasons > 0 && cachedSeasons.size >= expectedSeasons;
      // Check if we have enough episodes (80% threshold)
      const hasEnoughEpisodes = expectedEpisodes === 0 || cachedCount >= expectedEpisodes * 0.8;
      // Consider complete only if both conditions are met
      const isComplete = hasAllSeasons && hasEnoughEpisodes;

      return {
        show,
        hasEpisodes: cachedCount > 0,
        episodeCount: cachedCount,
        cachedSeasons: cachedSeasons.size,
        expectedSeasons,
        isComplete,
      };
    })
  );

  // Separate shows that need fetching: either no episodes OR incomplete cache
  const showsToFetch = cacheChecks.filter(c => !c.isComplete);

  // Fast path: If all shows are cached, return immediately
  if (showsToFetch.length === 0) {
    return;
  }

  // Import functions
  const { getShowDetails, getSeason, getImageUrl } = await import('./tmdb.js');
  const { getAnimeEpisodes } = await import('./jikan.js');

  // Create fetch tasks (functions that return promises)
  const fetchTasks = showsToFetch.map((item, index) => async () => {
    // Stagger requests to respect API rate limits
    // TMDB: 40 req/10s = 250ms between, Jikan: 3 req/sec = 350ms between
    const delay = item.show.data_source === 'jikan' ? 350 : 250;
    await new Promise(resolve => setTimeout(resolve, index * delay));
    
    try {
      let fetchedCount = 0;

      if (item.show.data_source === 'jikan' && item.show.mal_id) {
        // Fetch from Jikan - collect all episodes first
        let page = 1;
        let hasMore = true;
        const allEpisodes: any[] = [];

        while (hasMore) {
          const jikanEpisodes = await getAnimeEpisodes(item.show.mal_id, page);
          allEpisodes.push(...(jikanEpisodes.episodes || []));
          hasMore = page < (jikanEpisodes.pagination?.last_visible_page || 1);
          page++;
        }

        // Batch check existence in ONE query
        const existingEpisodes = await db
          .selectFrom('episodes')
          .select(['episode_number'])
          .where('content_id', '=', item.show.id)
          .where('season', '=', 1)
          .execute();

        const existingSet = new Set(
          existingEpisodes.map(e => e.episode_number)
        );

        // Filter to only new episodes
        const newEpisodes = allEpisodes
          .map((ep, idx) => ({
            episodeNum: ep.episode || idx + 1,
            data: ep,
          }))
          .filter(({ episodeNum }) => !existingSet.has(episodeNum));

        // Batch insert all new episodes in transaction
        if (newEpisodes.length > 0) {
          await db.transaction().execute(async (trx) => {
            // Insert in batches of 100 to avoid query size limits
            for (let i = 0; i < newEpisodes.length; i += 100) {
              const batch = newEpisodes.slice(i, i + 100);
              await trx.insertInto('episodes')
                .values(batch.map(({ episodeNum, data }) => ({
                  id: crypto.randomUUID(),
                  content_id: item.show.id,
                  season: 1,
                  episode_number: episodeNum,
                  title: data.title || `Episode ${episodeNum}`,
                  overview: null,
                  duration: item.show.default_duration || 24,
                  air_date: data.aired ? new Date(data.aired) : null,
                  still_url: data.images?.jpg?.image_url || null,
                  created_at: new Date(),
                })))
                .execute();
            }
          });
          fetchedCount = newEpisodes.length;
        }
      } else if (item.show.tmdb_id) {
        // Fetch from TMDB
        const showDetails = await getShowDetails(item.show.tmdb_id);

        // Collect all episodes from all seasons first
        const allEpisodes: Array<{
          season: number;
          episode_number: number;
          name: string;
          overview: string | null;
          runtime: number;
          air_date: string | null;
          still_path: string | null;
        }> = [];

        // Fetch seasons sequentially
        for (let seasonNum = 1; seasonNum <= (showDetails.number_of_seasons || 0); seasonNum++) {
          try {
            const tmdbSeason = await getSeason(item.show.tmdb_id, seasonNum);
            for (const ep of tmdbSeason.episodes) {
              allEpisodes.push({
                season: ep.season_number,
                episode_number: ep.episode_number,
                name: ep.name,
                overview: ep.overview,
                runtime: ep.runtime || showDetails.episode_run_time?.[0] || 30,
                air_date: ep.air_date,
                still_path: ep.still_path,
              });
            }
          } catch {
            // Season fetch failed, continue with others
          }
        }

        // Batch check existence in ONE query
        const existingEpisodes = await db
          .selectFrom('episodes')
          .select(['season', 'episode_number'])
          .where('content_id', '=', item.show.id)
          .execute();

        const existingSet = new Set(
          existingEpisodes.map(e => `${e.season}-${e.episode_number}`)
        );

        // Filter to only new episodes
        const newEpisodes = allEpisodes.filter(ep => {
          const key = `${ep.season}-${ep.episode_number}`;
          return !existingSet.has(key);
        });

        // Batch insert all new episodes in transaction
        if (newEpisodes.length > 0) {
          await db.transaction().execute(async (trx) => {
            // Insert in batches of 100 to avoid query size limits
            for (let i = 0; i < newEpisodes.length; i += 100) {
              const batch = newEpisodes.slice(i, i + 100);
              await trx.insertInto('episodes')
                .values(batch.map(ep => ({
                  id: crypto.randomUUID(),
                  content_id: item.show.id,
                  season: ep.season,
                  episode_number: ep.episode_number,
                  title: ep.name,
                  overview: ep.overview,
                  duration: ep.runtime,
                  air_date: ep.air_date ? new Date(ep.air_date) : null,
                  still_url: getImageUrl(ep.still_path),
                  created_at: new Date(),
                })))
                .execute();
            }
          });
          fetchedCount = newEpisodes.length;
        }
      }

      return fetchedCount;
    } catch {
      return 0;
    }
  });

  // Limit concurrency to 2 shows at a time to avoid overwhelming connection pool
  // This reduces from potentially 5+ concurrent shows to just 2
  await limitConcurrency(fetchTasks, 2);
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

  // Auto-fetch episodes before generating schedule (fast cache check first)
  await ensureEpisodesFetched(showIds);

  return generateSchedule({
    userId,
    showIds,
    startDate,
    endDate,
    timeSlots,
    timezoneOffset: options.timezoneOffset || '+00:00', // Default to UTC if not provided
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
    timezone_offset?: string;
  }>,
  sourceType: 'manual' | 'auto' | 'block' | 'rotation' = 'auto',
  sourceId: string | null = null
) {
  if (scheduleItems.length === 0) {
    return [];
  }

  // Use transaction to ensure connection closes quickly
  return await db.transaction().execute(async (trx) => {
    const saved: any[] = [];
    // Insert in batches of 100 to avoid query size limits
    for (let i = 0; i < scheduleItems.length; i += 100) {
      const batch = scheduleItems.slice(i, i + 100);
      const inserted = await trx
        .insertInto('schedule')
        .values(
          batch.map((item) => ({
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
            timezone_offset: item.timezone_offset || '+00:00', // Default to UTC if not provided
            created_at: new Date(),
          }))
        )
        .returningAll()
        .execute();
      saved.push(...inserted);
    }
    return saved;
  });
}
