import { useCallback, useState } from 'react';

export type PosterSize = 'sm' | 'md' | 'lg';

/**
 * Responsive grid column/gap presets per poster size. Full static class strings
 * (Tailwind can't see dynamically-built class names). Shared by the Library wall
 * and the collection-detail poster grid so the size control feels consistent.
 */
export const POSTER_GRID: Record<PosterSize, string> = {
  sm: 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 md:gap-2.5',
  md: 'grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-3 md:gap-3.5',
  lg: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5',
};

/**
 * Persisted poster-size preference, scoped per surface so each page remembers
 * its own density independently (e.g. 'wall', 'lists', 'list-detail').
 */
export function usePosterSize(scope: string) {
  const storageKey = `ssss:poster-size:${scope}`;
  const [size, setSizeState] = useState<PosterSize>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    return saved === 'sm' || saved === 'md' || saved === 'lg' ? saved : 'md';
  });

  const setSize = useCallback(
    (next: PosterSize) => {
      setSizeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // ignore storage failures
      }
    },
    [storageKey]
  );

  return { size, setSize };
}
