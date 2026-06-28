import { Tv } from 'lucide-react';
import type { PosterSize } from '../../hooks/usePosterSize';

interface CollectionListCardProps {
  name: string;
  description?: string;
  count: number;
  ranked: boolean;
  /** Poster URLs (nulls allowed), in list order. */
  posters: (string | null)[];
  size?: PosterSize;
  onClick: () => void;
}

const MAX_POSTERS = 8;

// Strip height + tuck overlap per poster size (matches the wall/grid size control).
const STRIP: Record<PosterSize, { height: string; tuck: string }> = {
  sm: { height: 'h-20 sm:h-24', tuck: '-ml-7 sm:-ml-9' },
  md: { height: 'h-24 sm:h-28', tuck: '-ml-8 sm:-ml-10' },
  lg: { height: 'h-32 sm:h-40', tuck: '-ml-11 sm:-ml-14' },
};

/**
 * Letterboxd-style list row: a horizontal overlapping poster strip (leftmost on
 * top, each tucked behind the next), then title + optional description + meta.
 */
export function CollectionListCard({ name, description, count, ranked, posters, size = 'md', onClick }: CollectionListCardProps) {
  const strip = posters.slice(0, MAX_POSTERS);
  const conf = STRIP[size];
  return (
    <button type="button" onClick={onClick} className="block w-full text-left group">
      <div className={`${conf.height} mb-3`}>
        <div className="flex h-full">
          {strip.length === 0 ? (
            <div className="h-full aspect-[2/3] rounded-md bg-[rgb(var(--color-bg-elevated))] flex items-center justify-center">
              <Tv className="w-6 h-6 text-[rgb(var(--color-text-tertiary))]" />
            </div>
          ) : (
            strip.map((url, i) => (
              <div
                key={i}
                className={`h-full aspect-[2/3] rounded-md overflow-hidden shadow-md ring-1 ring-black/5 bg-[rgb(var(--color-bg-elevated))] ${
                  i === 0 ? '' : conf.tuck
                }`}
                style={{ zIndex: strip.length - i }}
              >
                {url ? (
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tv className="w-5 h-5 text-[rgb(var(--color-text-tertiary))]" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <h3 className="text-base font-semibold text-[rgb(var(--color-text-primary))] group-hover:opacity-80 transition-opacity line-clamp-1">
        {name}
      </h3>
      {description && (
        <p className="text-sm text-[rgb(var(--color-text-secondary))] line-clamp-1 mt-0.5">{description}</p>
      )}
      <p className="text-xs text-[rgb(var(--color-text-tertiary))] mt-1">
        {count} {count === 1 ? 'title' : 'titles'}
        {ranked ? ' · ranked' : ''}
      </p>
    </button>
  );
}
