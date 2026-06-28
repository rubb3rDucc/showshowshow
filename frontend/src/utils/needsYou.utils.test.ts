import { describe, it, expect } from 'vitest';
import { buildNeedsYou } from './needsYou.utils';
import type { LibraryItem } from '../types/library.types';

const NOW = new Date('2026-06-01T00:00:00Z').getTime();
const DAY = 86400000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

function item(o: {
  id: string;
  status: string;
  score?: number | null;
  lastWatched?: string | null;
  completed?: string | null;
  created?: string;
}): LibraryItem {
  return {
    id: o.id,
    status: o.status,
    score: o.score ?? null,
    last_watched_at: o.lastWatched ?? null,
    completed_at: o.completed ?? null,
    created_at: o.created ?? daysAgo(1),
    progress: { total_episodes: 0, episodes_watched: 0 },
    content: { content_type: 'show' },
  } as unknown as LibraryItem;
}

describe('buildNeedsYou', () => {
  it('surfaces only actionable items (rate / drop / remove), round-robined', () => {
    const completed = [
      item({ id: 'rate', status: 'completed', score: null, completed: daysAgo(1) }),
      item({ id: 'rated', status: 'completed', score: 8, completed: daysAgo(1) }), // excluded
    ];
    const watching = [
      item({ id: 'drop', status: 'watching', lastWatched: daysAgo(70) }), // >= 60
      item({ id: 'active', status: 'watching', lastWatched: daysAgo(5) }), // excluded
    ];
    const backlog = [
      item({ id: 'remove', status: 'plan_to_watch', created: daysAgo(100) }), // >= 90
      item({ id: 'fresh', status: 'plan_to_watch', created: daysAgo(10) }), // excluded
    ];

    const ranked = buildNeedsYou(completed, watching, backlog, NOW);

    expect(ranked.map((r) => r.kind)).toEqual(['rate', 'drop', 'remove']);
    expect(ranked.map((r) => r.libraryItem.id)).toEqual(['rate', 'drop', 'remove']);
  });

  it('does not flag a rated completion or a recently-active show', () => {
    const completed = [item({ id: 'rated', status: 'completed', score: 9, completed: daysAgo(1) })];
    const watching = [item({ id: 'active', status: 'watching', lastWatched: daysAgo(3) })];
    expect(buildNeedsYou(completed, watching, [], NOW)).toEqual([]);
  });
});
