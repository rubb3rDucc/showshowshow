import { useQuery } from '@tanstack/react-query';
import { getSchedule } from '../api/schedule';
import type { ScheduleItem } from '../types/api';

/**
 * Format a date as YYYY-MM-DD string in local timezone
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Find the currently playing item based on current time
 */
function findCurrentlyPlaying(items: ScheduleItem[], now: Date): ScheduleItem | null {
  return items.find(item => {
    const start = new Date(item.scheduled_time);
    const end = new Date(start.getTime() + (item.duration || 30) * 60000);
    return now >= start && now < end;
  }) || null;
}

/**
 * Find items scheduled for later today (after the currently playing item)
 */
function findLaterItems(items: ScheduleItem[], nowItem: ScheduleItem | null): ScheduleItem[] {
  if (!nowItem) return [];

  const nowItemStart = new Date(nowItem.scheduled_time).getTime();

  return items
    .filter(item => {
      // Exclude the currently playing item
      if (item.id === nowItem.id) return false;
      // Include items that start after the now item
      const start = new Date(item.scheduled_time).getTime();
      return start > nowItemStart;
    })
    .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
}

/**
 * Find items scheduled earlier today (before the currently playing item)
 */
function findEarlierItems(items: ScheduleItem[], nowItem: ScheduleItem | null): ScheduleItem[] {
  if (!nowItem) return [];

  const nowItemStart = new Date(nowItem.scheduled_time).getTime();

  return items
    .filter(item => {
      // Exclude the currently playing item
      if (item.id === nowItem.id) return false;
      // Include items that started before the now item
      const start = new Date(item.scheduled_time).getTime();
      return start < nowItemStart;
    })
    .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
}

/**
 * Hook to fetch all data needed for the Home screen
 */
export function useHomeData() {
  const now = new Date();
  const yesterday = formatDateString(addDays(now, -1));
  const today = formatDateString(now);
  const tomorrow = formatDateString(addDays(now, 1));

  // Fetch yesterday's schedule (for "Last Night" section)
  const yesterdaySchedule = useQuery({
    queryKey: ['schedule', yesterday],
    queryFn: () => getSchedule(yesterday),
    staleTime: 30000,
  });

  // Fetch today's schedule
  const todaySchedule = useQuery({
    queryKey: ['schedule', today],
    queryFn: () => getSchedule(today),
    staleTime: 30000,
  });

  // Fetch tomorrow's schedule (for "Coming up" count)
  const tomorrowSchedule = useQuery({
    queryKey: ['schedule', tomorrow],
    queryFn: () => getSchedule(tomorrow),
    staleTime: 30000,
  });

  // Filter yesterday to only unwatched items
  const lastNightUnwatched = (yesterdaySchedule.data || []).filter(item => !item.watched);

  // Sort today's items by time
  const todayItems = (todaySchedule.data || []).sort(
    (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
  );

  // Determine "now" item (currently playing based on time)
  // Only show as "now" if the item is actually within its playback window
  const nowItem = findCurrentlyPlaying(todayItems, now);

  // Check if we're before the first scheduled item
  const firstTodayItem = todayItems[0];
  const hasScheduleButNothingYet = todayItems.length > 0 && firstTodayItem && new Date(firstTodayItem.scheduled_time) > now;

  // Check if we're after the last scheduled item has ended
  const lastTodayItem = todayItems[todayItems.length - 1];
  const hasScheduleButAllEnded = todayItems.length > 0 && lastTodayItem && !nowItem && !hasScheduleButNothingYet;

  // Get items scheduled for later today (after the now item)
  const laterItems = findLaterItems(todayItems, nowItem);

  // Get items scheduled earlier today (before the now item)
  // If all shows have ended (no nowItem and not waiting for first show), show all items as "earlier"
  const earlierItems = hasScheduleButAllEnded
    ? todayItems
    : findEarlierItems(todayItems, nowItem);

  // All today items for "Coming up" state (when nothing is playing yet)
  const comingUpItems = hasScheduleButNothingYet ? todayItems : [];

  return {
    // Yesterday's unwatched items (for "Last Night" section)
    lastNight: lastNightUnwatched,
    // Currently playing item (or most recent past item)
    nowItem,
    // Items scheduled earlier today (before now item)
    earlierItems,
    // Items scheduled for later today
    laterItems,
    // All items if nothing is playing yet
    comingUpItems,
    // Whether we have a schedule but nothing is playing yet (all items are in the future)
    hasScheduleButNothingYet,
    // Whether all scheduled items have ended
    hasScheduleButAllEnded,
    // Tomorrow item count
    tomorrowCount: tomorrowSchedule.data?.length || 0,
    // Date strings for display
    dates: {
      yesterday,
      today,
      tomorrow,
    },
    // Loading states
    isLoading: todaySchedule.isLoading,
    isError: todaySchedule.isError,
    // Raw data access if needed
    todaySchedule: todaySchedule.data || [],
  };
}
