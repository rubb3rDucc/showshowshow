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

// Helper: Parse time string to Date (treating time as UTC)
// timeStr: "22:00" (in 24-hour format)
// date: Date object for the date (in UTC)
// timezoneOffset: not used, kept for compatibility
export function parseTime(timeStr: string, date: Date, timezoneOffset: string = '+00:00'): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Validate timezone offset format
  const offsetMatch = timezoneOffset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!offsetMatch) {
    console.warn(`Invalid timezone offset: ${timezoneOffset}, defaulting to UTC`);
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
  timezoneOffset?: string; // Timezone offset in format like "-05:00" (EST) or "+00:00" (UTC)
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
    timezoneOffset = '+00:00', // Default to UTC if not provided
    maxShowsPerTimeSlot = 1,
    includeReruns = false,
    rerunFrequency = 'rarely',
    rotationType = 'round_robin',
  } = options;
  
  console.log(`[Schedule Generator] Using timezone offset: ${timezoneOffset}`);

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
        const showInfo = shows.find(s => s.id === showId);
        // Shuffle episodes to randomize selection order
        episodesByShow.set(showId, shuffleArray(showEpisodes));
        console.log(`[Schedule Generator] ${showInfo?.title || showId}: ${showEpisodes.length} available episodes`);
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
    timezone_offset: string;
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

    console.log(`[Schedule Generator] Day ${currentDate.toISOString().split('T')[0]}: Start=${dayStartTime.toISOString()}, End=${dayEndTime.toISOString()}`);

    // Reset lastScheduledEndTime for each new day
    lastScheduledEndTime = null;

    // Generate schedule for this day
    for (const timeSlot of timeSlots) {
      const scheduledTime = parseTime(timeSlot, currentDate, timezoneOffset);
      
      // If the scheduled time ends up before the day's start time after timezone conversion,
      // it means it crossed into the next UTC day, so move it forward
      if (scheduledTime < dayStartTime) {
        scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
        console.log(`[Schedule Generator] Moved slot ${timeSlot} to next day: ${scheduledTime.toISOString()}`);
      }
      
      // After adjustment, check if it's still before start or after end
      if (scheduledTime < dayStartTime || scheduledTime >= dayEndTime) {
        console.log(`[Schedule Generator] Skipping slot ${timeSlot} - outside scheduling window (${scheduledTime.toISOString()})`);
        continue;
      }

      // Skip this time slot if it overlaps with previously scheduled content
      if (lastScheduledEndTime && scheduledTime < lastScheduledEndTime) {
        console.log(`[Schedule Generator] Skipping slot ${timeSlot} - overlaps with previous content (ends at ${lastScheduledEndTime.toISOString()})`);
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
      if (rotationType === 'round_robin') {
        // Try to find next available content in round-robin order
        let attempts = 0;
        while (attempts < showIds.length) {
          const candidateId = showIds[showIndex % showIds.length];
          showIndex++;
          attempts++;
          
          // Check if this content has available episodes or is a movie
          const episodes = episodesByShow.get(candidateId) ?? [];
          const movies = moviesByShow.get(candidateId) ?? [];
          const episodeIndex = episodeIndexes.get(candidateId) ?? 0;
          
          console.log(`[Schedule Generator] Round-robin check: ${candidateId} - episodeIndex=${episodeIndex}, episodes.length=${episodes.length}, movies.length=${movies.length}`);
          
          if (episodeIndex < episodes.length || movies.length > 0) {
            currentContentId = candidateId;
            console.log(`[Schedule Generator] Selected content: ${candidateId}`);
            break;
          }
        }
        
        // If we tried all shows and none have content, break out of time slot loop
        if (!currentContentId) {
          console.log(`[Schedule Generator] No more content available - breaking time slot loop`);
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
          console.log(`[Schedule Generator] Skipping movie with invalid duration: ${duration}`);
          moviesByShow.delete(currentContentId); // Remove from available movies
          continue;
        }

        // Check if movie fits in remaining time slots
        const endTime = addMinutes(scheduledTime, duration);

        // Don't schedule if movie doesn't fit in the day's time window
        if (endTime > dayEndTime) {
          console.log(`[Schedule Generator] Skipping movie - doesn't fit in day window (ends ${endTime.toISOString()}, day ends ${dayEndTime.toISOString()})`);
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
        console.log(`[Schedule Generator] Scheduled movie at ${scheduledTime.toISOString()}, ends at ${endTime.toISOString()} (${duration} min)`);

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
        console.log(`[Schedule Generator] Skipping episode - doesn't fit in day window (ends ${endTime.toISOString()}, day ends ${dayEndTime.toISOString()})`);
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
      console.log(`[Schedule Generator] Scheduled episode at ${scheduledTime.toISOString()}, ends at ${endTime.toISOString()} (${duration} min)`);

      // Update indexes
      episodeIndexes.set(currentContentId, episodeIndex + 1);
      timeSlotUsage.set(slotKey, currentUsage + 1);
    }

    // Move to next day (in UTC)
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  console.log(`[Schedule Generator] Generated ${schedule.length} schedule items`);
  
  // Summary: Show what happened to each piece of content
  console.log('[Schedule Generator] === Content Summary ===');
  showIds.forEach((showId) => {
    const contentItem = contentItems.find(c => c.id === showId);
    const episodesForShow = episodesByShow.get(showId) ?? [];
    const moviesForShow = moviesByShow.get(showId);
    const scheduledCount = schedule.filter(s => s.content_id === showId).length;
    
    if (!contentItem) {
      console.log(`[Schedule Generator] ⚠️  ${showId}: Not found in database`);
      return;
    }
    
    if (contentItem.content_type === 'show') {
      if (episodesForShow.length === 0) {
        console.log(`[Schedule Generator] ❌ ${contentItem.title}: No episodes available (${scheduledCount} scheduled)`);
        console.log(`[Schedule Generator]    → Possible reasons: Episodes not fetched, all watched (reruns=${includeReruns}), or invalid durations`);
      } else {
        console.log(`[Schedule Generator] ✅ ${contentItem.title}: ${episodesForShow.length} episodes available, ${scheduledCount} scheduled`);
      }
    } else if (contentItem.content_type === 'movie') {
      if (moviesForShow && moviesForShow.length > 0) {
        console.log(`[Schedule Generator] ✅ ${contentItem.title}: Movie available, ${scheduledCount} scheduled`);
      } else {
        console.log(`[Schedule Generator] ❌ ${contentItem.title}: Movie not available (${scheduledCount} scheduled)`);
        console.log(`[Schedule Generator]    → Possible reasons: Already watched (reruns=${includeReruns}), or invalid duration`);
      }
    }
  });
  console.log('[Schedule Generator] === End Summary ===');
  
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

  console.log(`[Schedule Generator] Analyzing ${shows.length} shows and ${movies.length} movies for optimal slot duration`);

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

  console.log(`[Schedule Generator] Found ${episodeDurations.length} episode durations:`, episodeDurations.slice(0, 10));

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
    console.log(`[Schedule Generator] Most common episode duration: ${targetDuration} minutes`);
  } else if (movies.length > 0) {
    // If only movies, use their average duration divided by 4 (for granularity)
    const movieDurations = movies
      .map(m => m.default_duration)
      .filter((d): d is number => d !== null && d > 0);
    
    const avgMovieDuration = movieDurations.reduce((sum, d) => sum + d, 0) / movieDurations.length;
    targetDuration = Math.floor(avgMovieDuration / 4); // Divide by 4 for more granular slots
    console.log(`[Schedule Generator] Average movie duration: ${avgMovieDuration}, using ${targetDuration} for slots`);
  } else {
    targetDuration = 30; // Fallback
    console.log(`[Schedule Generator] No valid durations found, using default 30 minutes`);
  }

  // Round up to nearest multiple of 15
  const slotDuration = Math.max(15, Math.ceil(targetDuration / 15) * 15);
  console.log(`[Schedule Generator] Optimal time slot duration: ${slotDuration} minutes (rounded from ${targetDuration})`);

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

  console.log(`[Schedule Generator] Checking ${shows.length} show(s) for episodes...`);

  // Fast cache check for all shows in parallel (DB queries are fast)
  const cacheChecks = await Promise.all(
    shows.map(async (show) => {
      const episodeCount = await db
        .selectFrom('episodes')
        .where('content_id', '=', show.id)
        .select((eb) => eb.fn.count('id').as('count'))
        .executeTakeFirst();
      
      return {
        show,
        hasEpisodes: Number(episodeCount?.count ?? 0) > 0,
        episodeCount: Number(episodeCount?.count ?? 0),
      };
    })
  );

  // Separate shows that need fetching vs already cached
  const showsToFetch = cacheChecks.filter(c => !c.hasEpisodes);
  const showsCached = cacheChecks.filter(c => c.hasEpisodes);

  console.log(`[Schedule Generator] ${showsCached.length} show(s) already cached, ${showsToFetch.length} need fetching`);

  // Fast path: If all shows are cached, return immediately
  if (showsToFetch.length === 0) {
    console.log('[Schedule Generator] ✅ All episodes already cached - skipping fetch');
    return;
  }

  // Import functions
  const { getShowDetails, getSeason, getImageUrl } = await import('./tmdb.js');
  const { getAnimeEpisodes } = await import('./jikan.js');

  // Only fetch missing shows - do in parallel with rate limiting
  const fetchPromises = showsToFetch.map(async (item, index) => {
    // Stagger requests to respect API rate limits
    // TMDB: 40 req/10s = 250ms between, Jikan: 3 req/sec = 350ms between
    const delay = item.show.data_source === 'jikan' ? 350 : 250;
    await new Promise(resolve => setTimeout(resolve, index * delay));
    
    try {
      let fetchedCount = 0;

      if (item.show.data_source === 'jikan' && item.show.mal_id) {
        // Fetch from Jikan
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const jikanEpisodes = await getAnimeEpisodes(item.show.mal_id, page);
          const episodes = jikanEpisodes.episodes || [];
          
          for (const ep of episodes) {
            const episodeNum = ep.episode || fetchedCount + 1;
            // Check if this specific episode already exists
            const exists = await db
              .selectFrom('episodes')
              .select('id')
              .where('content_id', '=', item.show.id)
              .where('season', '=', 1) // Jikan doesn't have seasons
              .where('episode_number', '=', episodeNum)
              .executeTakeFirst();
            
            if (!exists) {
              await db
                .insertInto('episodes')
                .values({
                  id: crypto.randomUUID(),
                  content_id: item.show.id,
                  season: 1, // Jikan doesn't have seasons
                  episode_number: episodeNum,
                  title: ep.title || `Episode ${episodeNum}`,
                  overview: null, // Jikan API doesn't provide episode descriptions
                  duration: item.show.default_duration || 24,
                  air_date: ep.aired ? new Date(ep.aired) : null,
                  still_url: ep.images?.jpg?.image_url || null,
                  created_at: new Date(),
                })
                .execute();
              fetchedCount++;
            }
          }

          hasMore = page < (jikanEpisodes.pagination?.last_visible_page || 1);
          page++;
        }
      } else if (item.show.tmdb_id) {
        // Fetch from TMDB
        const showDetails = await getShowDetails(item.show.tmdb_id);

        // Fetch seasons sequentially
        for (let seasonNum = 1; seasonNum <= (showDetails.number_of_seasons || 0); seasonNum++) {
          try {
            const tmdbSeason = await getSeason(item.show.tmdb_id, seasonNum);
            
            for (const ep of tmdbSeason.episodes) {
              // Check if this specific episode already exists (defensive check)
              const exists = await db
                .selectFrom('episodes')
                .select('id')
                .where('content_id', '=', item.show.id)
                .where('season', '=', ep.season_number)
                .where('episode_number', '=', ep.episode_number)
                .executeTakeFirst();
              
              if (!exists) {
                await db
                  .insertInto('episodes')
                  .values({
                    id: crypto.randomUUID(),
                    content_id: item.show.id,
                    season: ep.season_number,
                    episode_number: ep.episode_number,
                    title: ep.name,
                    overview: ep.overview,
                    duration: ep.runtime || showDetails.episode_run_time?.[0] || 30,
                    air_date: ep.air_date ? new Date(ep.air_date) : null,
                    still_url: getImageUrl(ep.still_path),
                    created_at: new Date(),
                  })
                  .execute();
                fetchedCount++;
              }
            }
          } catch (error) {
            console.warn(`[Schedule Generator] Failed to fetch season ${seasonNum} for ${item.show.title}:`, error);
          }
        }
      } else {
        console.warn(`[Schedule Generator] Show ${item.show.title} has no valid source ID (tmdb_id or mal_id)`);
      }
      
      console.log(`[Schedule Generator] ✅ Fetched ${fetchedCount} episodes for ${item.show.title}`);
    } catch (error) {
      console.error(`[Schedule Generator] ❌ Failed to fetch episodes for ${item.show.title}:`, error);
      // Continue with other shows even if one fails
    }
  });

  // Wait for all fetches (but don't block if some fail)
  await Promise.allSettled(fetchPromises);
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
        timezone_offset: item.timezone_offset || '+00:00', // Default to UTC if not provided
        created_at: new Date(),
      }))
    )
    .returningAll()
    .execute();

  return saved;
}
