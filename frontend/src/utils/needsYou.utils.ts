import { formatLastWatched } from './library.utils';
import type { LibraryItem } from '../types/library.types';

export type NeedsYouKind = 'rate' | 'drop' | 'remove';

export interface NeedsYouItem {
  libraryItem: LibraryItem;
  kind: NeedsYouKind;
}

// Staggered LONGER than Up next's STALE_DAYS (21) so an item surfaces in Up next first
// (resume), and only escalates here (prune) once it's clearly been abandoned.
export const DROP_STALE_DAYS = 60;
export const REMOVE_AGED_DAYS = 90;
export const NEEDS_YOU_VISIBLE = 4;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toTime(ts: string | null): number {
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function daysSince(ts: number, now: number): number {
  if (!ts) return Infinity;
  return Math.floor((now - ts) / MS_PER_DAY);
}

// Last meaningful activity for a watching item; falls back to created_at so it still ages.
function lastActivity(item: LibraryItem): number {
  return toTime(item.last_watched_at) || toTime(item.created_at);
}

function completedTime(item: LibraryItem): number {
  return toTime(item.completed_at) || toTime(item.last_watched_at) || toTime(item.created_at);
}

function classify(item: LibraryItem, now: number): NeedsYouKind | null {
  switch (item.status) {
    case 'completed':
      return item.score == null ? 'rate' : null;
    case 'watching':
      return daysSince(lastActivity(item), now) >= DROP_STALE_DAYS ? 'drop' : null;
    case 'plan_to_watch':
      return daysSince(toTime(item.created_at), now) >= REMOVE_AGED_DAYS ? 'remove' : null;
    default:
      return null;
  }
}

/**
 * Build the "Needs you" decisions-&-cleanup inbox: things only the user can decide —
 * rate a finished title, drop an abandoned show, remove aging backlog. Pure; derives
 * everything from status / score / last_watched_at / created_at.
 */
export function buildNeedsYou(
  completed: LibraryItem[],
  watching: LibraryItem[],
  backlog: LibraryItem[],
  now: number = Date.now()
): NeedsYouItem[] {
  const buckets: Record<NeedsYouKind, LibraryItem[]> = { rate: [], drop: [], remove: [] };

  for (const item of completed) if (classify(item, now) === 'rate') buckets.rate.push(item);
  for (const item of watching) if (classify(item, now) === 'drop') buckets.drop.push(item);
  for (const item of backlog) if (classify(item, now) === 'remove') buckets.remove.push(item);

  buckets.rate.sort((a, b) => completedTime(b) - completedTime(a)); // most recently finished first
  buckets.drop.sort((a, b) => lastActivity(a) - lastActivity(b)); // stalest first
  buckets.remove.sort((a, b) => toTime(a.created_at) - toTime(b.created_at)); // oldest backlog first

  const order: NeedsYouKind[] = ['rate', 'drop', 'remove'];
  const cursors: Record<NeedsYouKind, number> = { rate: 0, drop: 0, remove: 0 };
  const total = buckets.rate.length + buckets.drop.length + buckets.remove.length;
  const ranked: NeedsYouItem[] = [];

  while (ranked.length < total) {
    let progressed = false;
    for (const kind of order) {
      const cursor = cursors[kind];
      if (cursor < buckets[kind].length) {
        ranked.push({ libraryItem: buckets[kind][cursor], kind });
        cursors[kind] = cursor + 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return ranked;
}

/**
 * Single source of truth for each kind's badge + matching reason. Badge = short status tag,
 * reason = the concrete "why it's here" (mirrors the Up next CATEGORY_META convention).
 */
export const CATEGORY_META: Record<
  NeedsYouKind,
  { badge: string; classes: string; reason: (item: LibraryItem) => string }
> = {
  rate: {
    badge: 'Rate',
    classes: 'bg-amber-500 text-black',
    reason: (item) => `Completed ${formatLastWatched(item.completed_at ?? item.last_watched_at)}`,
  },
  drop: {
    badge: 'Stalled',
    classes: 'bg-orange-500 text-black',
    reason: (item) => {
      const when = formatLastWatched(item.last_watched_at);
      if (item.content.content_type === 'movie') return `Last watched ${when}`;
      const { episodes_watched, total_episodes } = item.progress;
      return `${episodes_watched} of ${total_episodes} watched, last watched ${when}`;
    },
  },
  remove: {
    badge: 'Aging',
    classes: 'bg-slate-600 text-white',
    reason: (item) => `Added ${formatLastWatched(item.created_at)}, never started`,
  },
};
