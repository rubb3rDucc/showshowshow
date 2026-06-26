import { Temporal } from 'temporal-polyfill';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { BASE_DATE, sxLineup } from './mockSchedule';

// Shared Schedule-X events-service instance (kept out of the component files so
// each of those only exports components, per react-refresh).
export const eventsService = createEventsServicePlugin();

const pad = (n: number) => String(n).padStart(2, '0');
const atMin = (min: number) =>
  Temporal.ZonedDateTime.from(`${BASE_DATE}T${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}:00[UTC]`);
const hhmmToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// We track occupied intervals ourselves (seeded from the lineup) instead of
// reading the plugin's internals — getAll() depends on calendar-lifecycle state
// that isn't reliably available when we need conflict checks.
type Occ = { id: string; start: number; end: number; title: string };
const occupied: Occ[] = sxLineup.map((e) => ({
  id: e.id,
  start: hhmmToMin(e.start),
  end: hhmmToMin(e.end),
  title: e.title,
}));

// Imperative manual placement — drops a block at an exact start time + length.
let manualCount = 0;
export function addManualMock(title: string, startMin: number, lengthMin: number) {
  manualCount += 1;
  const id = `manual-${manualCount}`;
  eventsService.add({ id, title, start: atMin(startMin), end: atMin(startMin + lengthMin) });
  occupied.push({ id, start: startMin, end: startMin + lengthMin, title });
}

// Remove a single event (keeps our occupancy list in sync).
export function removeEvent(id: string) {
  eventsService.remove(id);
  const i = occupied.findIndex((o) => o.id === id);
  if (i >= 0) occupied.splice(i, 1);
}

// Remove every event from the timeline.
export function clearSchedule() {
  occupied.slice().forEach((o) => eventsService.remove(o.id));
  occupied.length = 0;
}

// Current occupied intervals (minutes-of-day) for conflict detection.
export function getOccupied(): Array<{ start: number; end: number; title: string }> {
  return occupied.map(({ start, end, title }) => ({ start, end, title }));
}
