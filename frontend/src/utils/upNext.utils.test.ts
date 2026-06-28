import { describe, it, expect } from 'vitest';
import { buildUpNext, remaining } from './upNext.utils';
import type { LibraryItem } from '../types/library.types';

const NOW = new Date('2026-06-01T00:00:00Z').getTime();
const DAY = 86400000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

function item(o: {
  id: string;
  total?: number;
  watched?: number;
  lastWatched?: string | null;
  created?: string;
  contentType?: 'show' | 'movie';
}): LibraryItem {
  return {
    id: o.id,
    status: 'watching',
    score: null,
    last_watched_at: o.lastWatched ?? null,
    completed_at: null,
    created_at: o.created ?? daysAgo(100),
    progress: { total_episodes: o.total ?? 0, episodes_watched: o.watched ?? 0 },
    content: { content_type: o.contentType ?? 'show' },
  } as unknown as LibraryItem;
}

describe('buildUpNext', () => {
  it('categorizes in-progress shows and backlog, then round-robins by priority', () => {
    const finishSoon = item({ id: 'finish', total: 10, watched: 9, lastWatched: daysAgo(2) });
    const cont = item({ id: 'continue', total: 10, watched: 3, lastWatched: daysAgo(2) });
    const stalled = item({ id: 'restart', total: 10, watched: 3, lastWatched: daysAgo(30) });
    const backlog = item({ id: 'start', total: 10, watched: 0, lastWatched: null });

    const ranked = buildUpNext([finishSoon, cont, stalled], [backlog], NOW);

    expect(ranked.map((r) => r.category)).toEqual([
      'finish-soon',
      'continue',
      'restart',
      'start',
    ]);
    expect(ranked.map((r) => r.libraryItem.id)).toEqual([
      'finish',
      'continue',
      'restart',
      'start',
    ]);
  });

  it('treats a fully-watched-but-stale in-progress show as restart, not finish-soon', () => {
    const stale = item({ id: 's', total: 10, watched: 3, lastWatched: daysAgo(40) });
    const ranked = buildUpNext([stale], [], NOW);
    expect(ranked[0].category).toBe('restart');
  });

  it('returns an empty list when there is nothing to watch', () => {
    expect(buildUpNext([], [], NOW)).toEqual([]);
  });
});

describe('remaining', () => {
  it('counts episodes left, never negative', () => {
    expect(remaining(item({ id: 'a', total: 10, watched: 3 }))).toBe(7);
    expect(remaining(item({ id: 'b', total: 5, watched: 10 }))).toBe(0);
  });
});
