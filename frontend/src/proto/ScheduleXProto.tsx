import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import { createViewDay, createViewWeek } from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createScrollControllerPlugin } from '@schedule-x/scroll-controller';
import { X } from 'lucide-react';
import '@schedule-x/theme-default/dist/index.css';
import './schedulex-proto.css';
import { scheduleItemsToEvents, firstEventDate, firstEventTime } from './scheduleAdapter';
import type { ScheduleItem } from '../types/api';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local

type SxEvent = {
  id: string;
  title?: string;
  description?: string;
  watched?: boolean;
  timeLabel?: string;
  durationMin?: number;
};

const stop = (e: React.MouseEvent) => e.stopPropagation();

// How a block's remove button behaves — supplied by the page (deleteScheduleItem).
// Context reaches TimeGridEvent through Schedule-X's portal because the portaled
// component is a React-descendant of <ScheduleXCalendar>.
const RemoveContext = createContext<(id: string) => void>(() => {});

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
  const onRemove = useContext(RemoveContext);

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
        onClick={(e) => { stop(e); onRemove(calendarEvent.id); }}
        title="Remove"
        aria-label="Remove"
        // touch-manipulation: stop iOS double-tap-to-zoom firing when tapping remove on mobile.
        className="absolute right-0.5 top-0.5 flex h-6 w-6 touch-manipulation items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Single-timeline calendar over real backend schedule items. The adapter handles
 * local wall-clock, durations, and midnight crossover. Remount with a `key` when the
 * data set changes so events/selectedDate re-seed.
 */
export function ScheduleXProto({
  items,
  selectedDate,
  onRemove,
  view = 'day',
  windowStart,
}: {
  items: ScheduleItem[];
  selectedDate?: string;
  onRemove?: (id: string) => void;
  view?: 'day' | 'week';
  /** 24h "HH:MM" the schedule window opens at — where the timeline scrolls when there are no events yet. */
  windowStart?: string;
}) {
  // Seeds the calendar on first render; afterwards live updates flow through the effect
  // below (set()) rather than a remount, so editing an item doesn't rebuild the grid.
  const events = scheduleItemsToEvents(items);
  // `||` (not `??`) so an empty-string selectedDate falls through to a real date —
  // Temporal.PlainDate.from('') throws "can't parse empty string as date-time".
  const initialDate = selectedDate || firstEventDate(events) || today();

  // Stable plugin instances — these are wired into the calendar at creation, so they must
  // not be recreated (a fresh instance wouldn't be attached). Reusing one plugin across
  // calendar configs can also stop events from loading, hence per-mount via useMemo.
  const ownService = useMemo(() => createEventsServicePlugin(), []);
  const scrollController = useMemo(() => {
    // Open near the first item (floored to its hour for headroom), else the window start.
    // Mount-only seed; post-mount scrolling happens in the effect below.
    const t = firstEventTime(events);
    return createScrollControllerPlugin({ initialScroll: t ? `${t.slice(0, 2)}:00` : (windowStart ?? '06:00') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calendar = useNextCalendarApp({
    views: [createViewDay(), createViewWeek()],
    defaultView: view,
    selectedDate: Temporal.PlainDate.from(initialDate),
    weekOptions: { gridHeight: 2880 }, // 120px/hour — matches the Lineup builder's slot sizing
    plugins: [ownService, scrollController],
    events,
  });

  // Keep events in sync WITHOUT remounting AND without repainting the whole grid: diff the
  // items against the last sync and only add/update/remove the events that changed, so
  // deleting one item removes just that block (set() replaced every event and flickered).
  // prevSigs starts null: the calendar is already seeded with the first render's events, so
  // the first run just records them. Scroll to the first item only on the initial populate.
  const didInitialScroll = useRef(false);
  const prevSigs = useRef<Map<string, string> | null>(null);
  const itemsSig = items.map((i) => `${i.id}|${i.scheduled_time}|${i.duration}|${i.watched ? 1 : 0}`).join(',');
  useEffect(() => {
    const sigOf = (it: ScheduleItem) =>
      `${it.scheduled_time}|${it.duration}|${it.watched ? 1 : 0}|${it.title}|${it.season}|${it.episode}`;
    const nextSigs = new Map(items.map((it) => [it.id, sigOf(it)] as const));

    if (prevSigs.current === null) {
      prevSigs.current = nextSigs; // already seeded at creation — don't re-add
    } else {
      const eventById = new Map(scheduleItemsToEvents(items).map((e) => [e.id, e] as const));
      for (const id of prevSigs.current.keys()) {
        if (!nextSigs.has(id)) ownService.remove(id); // gone -> remove just this block
      }
      for (const [id, sig] of nextSigs) {
        const ev = eventById.get(id);
        if (!ev) continue;
        const prev = prevSigs.current.get(id);
        if (prev === undefined) ownService.add(ev);
        else if (prev !== sig) ownService.update(ev);
      }
      prevSigs.current = nextSigs;
    }

    if (!didInitialScroll.current && items.length > 0) {
      const t = firstEventTime(scheduleItemsToEvents(items));
      if (t) requestAnimationFrame(() => scrollController.scrollTo(`${t.slice(0, 2)}:00`));
      didInitialScroll.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSig]);

  return (
    <RemoveContext.Provider value={onRemove ?? (() => {})}>
      <div className="h-[700px] rounded-lg border border-[rgb(var(--color-border-default))] overflow-hidden bg-white">
        <ScheduleXCalendar calendarApp={calendar} customComponents={{ timeGridEvent: TimeGridEvent }} />
      </div>
    </RemoveContext.Provider>
  );
}
