import { Tv, X } from 'lucide-react';
import type { LibraryItemUI } from '../../types/library.types';
import { captionFor } from '../../utils/library.utils';

interface LibraryPosterCardProps {
  item: LibraryItemUI;
  onOpen: (item: LibraryItemUI) => void;
  /** Rank number shown as a badge (ranked collection detail). */
  rank?: number;
  /** When provided, shows a quiet remove control on hover (collection detail). */
  onRemove?: (contentId: string) => void;
}

/**
 * Quiet, artwork-forward album-grid tile. Poster is the hero; a two-line caption
 * below carries title + one faint metadata line. No borders, no hover motion —
 * status is conveyed by muting finished/dropped posters and a 1px progress hairline.
 */
export function LibraryPosterCard({ item, onOpen, rank, onRemove }: LibraryPosterCardProps) {
  const { content, progress, status } = item;
  const muted = status === 'completed' || status === 'dropped';
  const showProgress =
    content.contentType === 'show' && status === 'watching' && progress && progress.percentage > 0;

  return (
    <div className="group">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="block w-full text-left"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[rgb(var(--color-bg-elevated))]">
          {content.posterUrl ? (
            <img
              src={content.posterUrl}
              alt={content.title}
              loading="lazy"
              className={`w-full h-full object-cover transition-[opacity,filter] duration-300 ${
                muted ? 'opacity-60 grayscale' : ''
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="w-10 h-10 text-[rgb(var(--color-text-tertiary))]" />
            </div>
          )}

          {/* Rank badge for ranked collections */}
          {rank !== undefined && (
            <span className="absolute top-1.5 left-1.5 min-w-[22px] h-[22px] px-1 inline-flex items-center justify-center rounded-md bg-black/65 text-white text-xs font-semibold tabular-nums">
              {rank}
            </span>
          )}

          {/* Quiet remove control (collection detail) */}
          {onRemove && (
            <button
              type="button"
              aria-label="Remove from list"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.contentId);
              }}
              className="absolute top-1.5 right-1.5 w-6 h-6 inline-flex items-center justify-center rounded-md bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/75"
            >
              <X size={13} />
            </button>
          )}

          {/* 1px neutral progress hairline */}
          {showProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/15">
              <div
                className="h-full bg-[#646cff]"
                style={{ width: `${progress!.percentage}%` }}
              />
            </div>
          )}
        </div>
      </button>

      {/* Caption */}
      <div className="mt-2">
        <p className="text-sm text-[rgb(var(--color-text-primary))] line-clamp-1">
          {content.title}
        </p>
        <p className="text-xs text-[rgb(var(--color-text-tertiary))] mt-0.5">
          {captionFor(item)}
        </p>
      </div>
    </div>
  );
}
