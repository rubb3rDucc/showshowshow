import type { SearchResult } from '../../types/api';
import { DiscoverPosterCard } from './DiscoverPosterCard';

interface DiscoverRowProps {
  title: string;
  items: SearchResult[];
  personalized?: boolean;
  onSeeAll: () => void;
  onItemClick: (item: SearchResult) => void;
}

/**
 * A single carousel row on the discovery wall: a quiet section header (with a
 * faint "See all" affordance) above a horizontally scrolling strip of poster
 * tiles. Matches the redesigned, borderless aesthetic.
 */
export function DiscoverRow({ title, items, personalized, onSeeAll, onItemClick }: DiscoverRowProps) {
  return (
    <section>
      <div className="flex items-end justify-between mb-3 px-4 md:px-0">
        <div>
          {personalized && (
            <p className="text-xs font-medium tracking-tight text-[#646cff] mb-0.5">For you</p>
          )}
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-[rgb(var(--color-text-primary))]">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center min-h-[40px] px-2 -mr-2 text-sm text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] transition-colors shrink-0"
        >
          See all
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-3 md:gap-4 pb-1">
          {items.map((item) => (
            <div key={item.tmdb_id} className="flex-shrink-0 w-32 sm:w-36 md:w-40">
              <DiscoverPosterCard item={item} onOpen={() => onItemClick(item)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
