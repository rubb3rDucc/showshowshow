// Adapter: backend ScheduleItem[] -> Schedule-X events.
// This is the bridge that lets the single-timeline proto render REAL schedule data
// (not just mockSchedule.ts) so we can test the actual time boundaries — midnight
// crossover, the start/end window, and timezone offsets.

import { Temporal } from 'temporal-polyfill';
import type { ScheduleItem } from '../types/api';

export type SxCalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  watched?: boolean;
  timeLabel: string; // e.g. "7:00 PM - 7:22 PM"
  durationMin: number;
};

const pad = (n: number) => String(n).padStart(2, '0');

// "7:00 PM" from a ZonedDateTime's wall-clock fields.
function fmtClock(z: Temporal.ZonedDateTime): string {
  const h12 = ((z.hour + 11) % 12) + 1;
  return `${h12}:${pad(z.minute)} ${z.hour < 12 ? 'AM' : 'PM'}`;
}

/** "7:00 PM - 7:22 PM" — matches the Lineup builder's block label. */
export function timeRangeLabel(start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime): string {
  return `${fmtClock(start)} - ${fmtClock(end)}`;
}

// "· S2E5" suffix when we have episode coordinates for a show.
function episodeLabel(item: ScheduleItem): string {
  if (item.content_type !== 'show' || item.season == null || item.episode == null) return '';
  return ` · S${item.season}E${item.episode}`;
}

/**
 * Turn one backend ScheduleItem into a Schedule-X event.
 *
 * `scheduled_time` is a UTC instant; `timezone_offset` (e.g. "-05:00") is the wall-clock
 * the user actually scheduled against. We resolve the instant in that offset to recover
 * the intended local wall-clock, then re-express those exact clock fields on a UTC-labelled
 * ZonedDateTime so Schedule-X renders them verbatim (mirroring how the mock builds `[UTC]`
 * events). `end = start + duration`; `.add()` rolls past midnight onto the REAL next day,
 * so a 22:00 → 02:00 block lands on two calendar days instead of wrapping back onto one —
 * which is exactly the boundary the proto exists to test.
 */
export function scheduleItemToEvent(item: ScheduleItem): SxCalendarEvent {
  const offset = item.timezone_offset ?? '+00:00';
  const local = Temporal.Instant.from(item.scheduled_time).toZonedDateTimeISO(offset);
  const start = Temporal.ZonedDateTime.from({
    timeZone: 'UTC',
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
    second: local.second,
  });
  const end = start.add({ minutes: item.duration });
  return {
    id: item.id,
    title: `${item.title}${episodeLabel(item)}`,
    description: item.content_type, // 'show' | 'movie'
    start,
    end,
    watched: item.watched,
    timeLabel: timeRangeLabel(start, end),
    durationMin: item.duration,
  };
}

export function scheduleItemsToEvents(items: ScheduleItem[]): SxCalendarEvent[] {
  return items.map(scheduleItemToEvent);
}

/** The event that starts earliest, or null if the list is empty. */
function earliestEvent(events: SxCalendarEvent[]): SxCalendarEvent | null {
  if (events.length === 0) return null;
  return events.reduce((a, b) =>
    Temporal.ZonedDateTime.compare(a.start, b.start) <= 0 ? a : b
  );
}

/** Calendar's `selectedDate`: the day the earliest event starts (YYYY-MM-DD), or null if empty. */
export function firstEventDate(events: SxCalendarEvent[]): string | null {
  const earliest = earliestEvent(events)?.start;
  if (!earliest) return null;
  return `${earliest.year}-${pad(earliest.month)}-${pad(earliest.day)}`;
}

/** Earliest event's wall-clock start as 24h "HH:MM", or null if empty — used to scroll the timeline to the first item. */
export function firstEventTime(events: SxCalendarEvent[]): string | null {
  const earliest = earliestEvent(events)?.start;
  if (!earliest) return null;
  return `${pad(earliest.hour)}:${pad(earliest.minute)}`;
}
