import { Tv, Star } from 'lucide-react';
import type { SearchResult } from '../../types/api';

interface DiscoverPosterCardProps {
  item: SearchResult;
  onOpen: () => void;
}

/**
 * Quiet, artwork-forward poster tile matching the Library redesign language:
 * poster is the hero in a rounded-lg frame, a two-line caption sits below, and
 * there are no borders or hover motion. Used in both the wall carousels and the
 * results grid.
 */
export function DiscoverPosterCard({ item, onOpen }: DiscoverPosterCardProps) {
  const year = item.release_date ? new Date(item.release_date).getFullYear() : null;
  const typeLabel = item.content_type === 'movie' ? 'Film' : 'TV';

  return (
    <div className="group">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[rgb(var(--color-bg-elevated))]">
          {item.poster_url ? (
            <img
              src={item.poster_url}
              alt={item.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="w-10 h-10 text-[rgb(var(--color-text-tertiary))]" />
            </div>
          )}
        </div>
      </button>

      <div className="mt-2">
        <p className="text-sm text-[rgb(var(--color-text-primary))] line-clamp-1">{item.title}</p>
        <p className="text-xs text-[rgb(var(--color-text-tertiary))] mt-0.5 flex items-center gap-1.5">
          <span>{typeLabel}</span>
          {year && (
            <>
              <span>·</span>
              <span>{year}</span>
            </>
          )}
          {item.vote_average > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Star size={10} className="fill-current text-amber-500" />
                {item.vote_average.toFixed(1)}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
