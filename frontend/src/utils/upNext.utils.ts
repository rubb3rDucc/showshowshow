import { formatLastWatched } from './library.utils';
import type { LibraryItem } from '../types/library.types';

export type UpNextCategory = 'finish-soon' | 'continue' | 'restart' | 'start';

export interface UpNextItem {
  libraryItem: LibraryItem;
  category: UpNextCategory;
}

/** How long since last watch before an in-progress show is treated as a "pick back up". */
export const STALE_DAYS = 21;
/** Remaining-episode count (inclusive) that qualifies a show as "finish soon". */
export const FINISH_SOON_MAX_REMAINING = 2;
/** How many suggestions the widget shows before "+N more". */
export const UP_NEXT_VISIBLE = 4;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function remainingEpisodes(item: LibraryItem): number | null {
  const total = item.progress.total_episodes;
  if (!total || total <= 0) return null;
  return total - item.progress.episodes_watched;
}

function hasStarted(item: LibraryItem): boolean {
  return item.progress.episodes_watched > 0;
}

function daysSinceLastWatched(item: LibraryItem, now: number): number {
  if (!item.last_watched_at) return Infinity;
  const ts = new Date(item.last_watched_at).getTime();
  if (Number.isNaN(ts)) return Infinity;
  return Math.floor((now - ts) / MS_PER_DAY);
}

function lastWatchedTime(item: LibraryItem): number {
  if (!item.last_watched_at) return 0;
  const ts = new Date(item.last_watched_at).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function createdTime(item: LibraryItem): number {
  const ts = new Date(item.created_at).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function categorizeWatching(item: LibraryItem, now: number): UpNextCategory {
  const remaining = remainingEpisodes(item);
  if (hasStarted(item) && remaining !== null && remaining >= 1 && remaining <= FINISH_SOON_MAX_REMAINING) {
    return 'finish-soon';
  }
  if (daysSinceLastWatched(item, now) >= STALE_DAYS) {
    return 'restart';
  }
  return 'continue';
}

/**
 * Build a single ranked "what to watch next" list from the user's library.
 *
 * Categorizes in-progress shows (finish-soon / continue / restart) and backlog
 * (start), sorts within each category, then round-robins across categories in
 * priority order so the list reads as a varied recommendation rather than one bucket.
 * Pure — derives everything from `progress` / `last_watched_at` / `status`
 * (current_season/current_episode are NOT auto-advanced by the backend, so ignored).
 */
export function buildUpNext(
  watching: LibraryItem[],
  backlog: LibraryItem[],
  now: number = Date.now()
): UpNextItem[] {
  const buckets: Record<UpNextCategory, LibraryItem[]> = {
    'finish-soon': [],
    continue: [],
    restart: [],
    start: [],
  };

  for (const item of watching) {
    buckets[categorizeWatching(item, now)].push(item);
  }
  for (const item of backlog) {
    buckets.start.push(item);
  }

  buckets['finish-soon'].sort((a, b) => {
    const ra = remainingEpisodes(a) ?? Infinity;
    const rb = remainingEpisodes(b) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return lastWatchedTime(b) - lastWatchedTime(a);
  });
  buckets.continue.sort((a, b) => lastWatchedTime(b) - lastWatchedTime(a));
  buckets.restart.sort((a, b) => lastWatchedTime(b) - lastWatchedTime(a));
  buckets.start.sort((a, b) => createdTime(b) - createdTime(a));

  // Round-robin across categories in priority order until all buckets are drained.
  const order: UpNextCategory[] = ['finish-soon', 'continue', 'restart', 'start'];
  const cursors: Record<UpNextCategory, number> = {
    'finish-soon': 0,
    continue: 0,
    restart: 0,
    start: 0,
  };
  const total = watching.length + backlog.length;
  const ranked: UpNextItem[] = [];

  while (ranked.length < total) {
    let progressed = false;
    for (const category of order) {
      const bucket = buckets[category];
      const cursor = cursors[category];
      if (cursor < bucket.length) {
        ranked.push({ libraryItem: bucket[cursor], category });
        cursors[category] = cursor + 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return ranked;
}

/** Episodes left to watch for an item (never negative). */
export function remaining(item: LibraryItem): number {
  return Math.max(0, item.progress.total_episodes - item.progress.episodes_watched);
}

/** Count-forward progress line shared by in-progress shows (Watching / Stalled). */
function progressReason(item: LibraryItem): string {
  if (item.content.content_type === 'movie') {
    return `Last watched ${formatLastWatched(item.last_watched_at)}`;
  }
  const { episodes_watched, total_episodes } = item.progress;
  return total_episodes > 0
    ? `${total_episodes} eps, ${episodes_watched} watched`
    : `${episodes_watched} watched`;
}

/**
 * Single source of truth for each category's badge label, chip color, and the
 * expanded "why this is here" reason. Keeping badge + reason defined together
 * keeps them consistent, and centralizing them here makes the pair reusable.
 */
export const CATEGORY_META: Record<
  UpNextCategory,
  { badge: string; classes: string; reason: (item: LibraryItem) => string }
> = {
  'finish-soon': {
    badge: 'Almost done',
    classes: 'bg-amber-500 text-black',
    reason: (item) => {
      if (item.content.content_type === 'movie') return 'Almost finished';
      const total = item.progress.total_episodes;
      return `${total} eps, ${remaining(item)} left`;
    },
  },
  continue: {
    badge: 'Watching',
    classes: 'bg-violet-600 text-white',
    reason: progressReason,
  },
  restart: {
    badge: 'Stalled',
    classes: 'bg-orange-500 text-black',
    reason: (item) => {
      if (item.content.content_type === 'movie') {
        return item.last_watched_at
          ? `Last watched ${formatLastWatched(item.last_watched_at)}`
          : 'Not watched in a while';
      }
      return progressReason(item);
    },
  },
  start: {
    badge: 'New',
    classes: 'bg-emerald-600 text-white',
    reason: (item) => {
      const unwatched = item.progress.total_episodes - item.progress.episodes_watched;
      if (item.content.content_type === 'movie' || unwatched <= 0) return 'In your backlog';
      return `${unwatched} unwatched eps in your backlog`;
    },
  },
};
