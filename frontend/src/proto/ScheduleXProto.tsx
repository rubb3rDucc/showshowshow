import { useMemo } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import { createViewDay, createViewWeek } from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { X } from 'lucide-react';
import '@schedule-x/theme-default/dist/index.css';
import './schedulex-proto.css';
import { BASE_DATE, sxLineup } from './mockSchedule';
import { eventsService, removeEvent } from './sxEvents';
import { scheduleItemsToEvents, firstEventDate, timeRangeLabel, type SxCalendarEvent } from './scheduleAdapter';
import type { ScheduleItem } from '../types/api';

// Schedule-X v4 requires Temporal event times; render in UTC so wall-clock matches.
const zdt = (hhmm: string) => Temporal.ZonedDateTime.from(`${BASE_DATE}T${hhmm}:00[UTC]`);

type SxEvent = {
  id: string;
  title?: string;
  description?: string;
  watched?: boolean;
  timeLabel?: string;
  durationMin?: number;
};

const stop = (e: React.MouseEvent) => e.stopPropagation();

// Accent palette drawn from the app's existing colors (home widgets / CATEGORY_META):
// violet, sky, rose, amber, orange, emerald, teal, indigo.
const ACCENT_PALETTE = ['#7c3aed', '#0ea5e9', '#e11d48', '#f59e0b', '#f97316', '#059669', '#14b8a6', '#646cff'];

// Stable per-event color: hash the id so each block keeps the same "random" accent
// across re-renders instead of flickering.
function accentForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[h % ACCENT_PALETTE.length];
}

// Custom event block — styled to match the Lineup builder's ScheduleBlock:
// white card, gray border, title + "time • duration" subline, plus a colored left accent.
// (Drag-to-move is Schedule-X's PAID @sx-premium/drag-and-drop plugin — not used here.)
function TimeGridEvent({ calendarEvent }: { calendarEvent: SxEvent }) {
  const watched = calendarEvent.watched ?? false; // read-only styling from real data
  const compact = (calendarEvent.durationMin ?? 60) <= 15;

  return (
    <div
      className="group relative h-full w-full overflow-hidden rounded-md border-2 border-gray-300 bg-white"
      style={{ opacity: watched ? 0.55 : 1, borderLeftWidth: 4, borderLeftColor: accentForId(calendarEvent.id ?? '') }}
    >
      {/* Inner column: compact blocks center their single line; taller blocks
          stack title + subline from the top. Tight padding so short blocks fit. */}
      <div className={`flex h-full flex-col px-2.5 py-1 ${compact ? 'justify-center' : 'justify-start'}`}>
        <p className={`truncate pr-5 font-medium text-gray-900 ${compact ? 'text-[11px]' : 'text-sm'} ${watched ? 'line-through' : ''}`}>
          {calendarEvent.title}
        </p>
        {!compact && calendarEvent.timeLabel && (
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {calendarEvent.timeLabel}
            {calendarEvent.durationMin != null && ` • ${calendarEvent.durationMin} min`}
          </p>
        )}
      </div>
      {/* Remove: subtle gray X, top-right, always present. */}
      <button
        onMouseDown={stop}
        onClick={(e) => { stop(e); removeEvent(calendarEvent.id); }}
        title="Remove"
        aria-label="Remove"
        className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <X size={14} />
      </button>
    </div>
  );
}

const mockEvents = (): SxCalendarEvent[] =>
  sxLineup.map((e) => {
    const start = zdt(e.start);
    const end = zdt(e.end);
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      start,
      end,
      timeLabel: timeRangeLabel(start, end),
      durationMin: Math.round((end.epochMilliseconds - start.epochMilliseconds) / 60000),
    };
  });

/**
 * Single-timeline calendar.
 * - No `items`: renders mockSchedule.ts (visual sign-off / drawer interactions).
 * - `items` provided: renders REAL backend schedule data via the adapter, so time
 *   boundaries (midnight crossover, window, timezone) can be tested for real.
 * Remount with a `key` when the data set changes so events/selectedDate re-seed.
 */
export function ScheduleXProto({ items, selectedDate }: { items?: ScheduleItem[]; selectedDate?: string } = {}) {
  const isReal = !!items;
  const events = items ? scheduleItemsToEvents(items) : mockEvents();
  const initialDate = selectedDate ?? firstEventDate(events) ?? BASE_DATE;

  // Mock mode reuses the shared singleton so the page's Add/Clear controls drive this
  // calendar. Real mode gets its own events-service — reusing one Schedule-X plugin
  // instance across two calendar configs can stop events from loading.
  const ownService = useMemo(() => (isReal ? createEventsServicePlugin() : null), [isReal]);

  const calendar = useNextCalendarApp({
    views: [createViewDay(), createViewWeek()],
    defaultView: 'day',
    selectedDate: Temporal.PlainDate.from(initialDate),
    weekOptions: { gridHeight: 2880 }, // 120px/hour — matches the Lineup builder's slot sizing
    plugins: [ownService ?? eventsService],
    events,
  });

  return (
    <div className="h-[700px] rounded-lg border border-[rgb(var(--color-border-default))] overflow-hidden bg-white">
      <ScheduleXCalendar calendarApp={calendar} customComponents={{ timeGridEvent: TimeGridEvent }} />
    </div>
  );
}
