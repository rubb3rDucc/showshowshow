import { Tv } from 'lucide-react';
import type { LibraryItemUI } from '../../types/library.types';
import { captionFor } from '../../utils/library.utils';

interface LibraryWallProps {
  items: LibraryItemUI[];
  onOpen: (item: LibraryItemUI) => void;
}

function WallTile({ item, onOpen }: { item: LibraryItemUI; onOpen: (i: LibraryItemUI) => void }) {
  const { content, status, progress } = item;
  const muted = status === 'completed' || status === 'dropped';
  const showProgress =
    content.contentType === 'show' && status === 'watching' && progress && progress.percentage > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative block aspect-[2/3] rounded-md overflow-hidden bg-white/5"
    >
      {content.posterUrl ? (
        <img
          src={content.posterUrl}
          alt={content.title}
          loading="lazy"
          className={`w-full h-full object-cover ${muted ? 'opacity-70' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[rgb(var(--color-bg-elevated))]">
          <Tv className="w-7 h-7 text-[rgb(var(--color-text-tertiary))]" />
        </div>
      )}

      {/* Title + status reveal on hover/focus */}
      <div className="absolute inset-0 flex flex-col justify-end p-2 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200">
        <span className="text-xs font-semibold text-white leading-tight line-clamp-2">{content.title}</span>
        <span className="text-[11px] text-white/70 mt-0.5">{captionFor(item)}</span>
      </div>

      {showProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/15">
          <div className="h-full bg-[#646cff]" style={{ width: `${progress!.percentage}%` }} />
        </div>
      )}
    </button>
  );
}

/**
 * Immersive "album wall" for the main grid view — dense, tight-gap, captionless
 * artwork with title/status revealed on hover. Renders on the page background
 * (no dark box). Evokes the Apple Music wall.
 */
export function LibraryWall({ items, onOpen }: LibraryWallProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-2.5">
      {items.map((item) => (
        <WallTile key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}
