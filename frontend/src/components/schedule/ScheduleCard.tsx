import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScheduleCardItem, QueueCardItem } from './scheduleCardAdapters';
import { markAsWatched, unmarkAsWatched } from '../../api/schedule';
import { normalizeRating } from '../../utils/rating';
import { QuietDesign } from '../../styles/quiet-design-system';

interface ScheduleCardProps {
  scheduleItem: ScheduleCardItem;
  queueItem?: QueueCardItem;
  rowNumber: number;
  season?: number | null;
  episode?: number | null;
  episodeTitle?: string | null;
  watched?: boolean;
}

export function ScheduleCard({
  scheduleItem,
  queueItem,
  season,
  episode,
  episodeTitle,
  watched = false,
}: ScheduleCardProps) {
  const queryClient = useQueryClient();
  const [isWatched, setIsWatched] = useState(watched);

  const watchedMutation = useMutation({
    mutationFn: () => isWatched ? unmarkAsWatched(scheduleItem.id) : markAsWatched(scheduleItem.id),
    onMutate: () => {
      // Optimistic update
      setIsWatched(!isWatched);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: () => {
      // Revert on error
      setIsWatched(isWatched);
    },
  });

  const durationMinutes = Math.round(
    (scheduleItem.endTime.getTime() - scheduleItem.startTime.getTime()) / 60000
  );

  const startTime = scheduleItem.startTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const endTime = scheduleItem.endTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const title = queueItem?.title || scheduleItem.title;
  const rating = normalizeRating(queueItem?.rating);

  const handleToggleWatched = () => {
    watchedMutation.mutate();
  };

  return (
    <div
      className={`
        bg-white border rounded-lg p-4
        transition-opacity duration-300
        ${isWatched ? 'opacity-30' : 'opacity-100'}
        ${isWatched ? 'grayscale' : ''}
        border-gray-200 hover:border-blue-500
      `}
      style={{
        borderWidth: QuietDesign.borders.width.default,
        borderRadius: QuietDesign.borders.radius.card,
        padding: QuietDesign.spacing.cardPadding,
      }}
    >
      {/* Mobile Layout (< md) */}
      <div className="md:hidden flex flex-col gap-3">
        {/* Time (Dominant) */}
        <div className="flex items-center gap-2">
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {startTime}
          </div>
          <div className="text-3xl font-normal text-gray-400 leading-none">—</div>
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {endTime}
          </div>
        </div>

        {/* Content Info */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 leading-tight mb-1">
            {title}
          </h2>
          {queueItem?.type === 'show' && season !== null && episode !== null && (
            <div className="text-sm text-gray-500 mb-1">
              S{String(season).padStart(2, '0')}E{String(episode).padStart(2, '0')}
              {episodeTitle && ` • ${episodeTitle}`}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{queueItem?.type === 'movie' ? 'Movie' : 'TV Show'}</span>
            {rating && (
              <>
                <span>•</span>
                <span>{rating}</span>
              </>
            )}
            <span>•</span>
            <span>{durationMinutes} min</span>
          </div>
        </div>

        {/* Poster + Watched Toggle */}
        <div className="flex items-center justify-between">
          {queueItem?.posterUrl && (
            <img
              src={queueItem.posterUrl}
              alt=""
              className={`object-cover ${isWatched ? 'grayscale' : ''}`}
              style={{
                width: '32px',
                height: '48px',
                borderRadius: QuietDesign.borders.radius.poster,
              }}
            />
          )}
          <button
            onClick={handleToggleWatched}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all
              ${
                isWatched
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-gray-300 hover:border-blue-500 text-gray-600 hover:text-blue-500'
              }
            `}
            style={{
              fontSize: QuietDesign.typography.sizes.metadata,
              transition: QuietDesign.transitions.fast,
            }}
            aria-label={isWatched ? `Mark as unwatched: ${title}` : `Mark as watched: ${title}`}
            aria-checked={isWatched}
          >
            {isWatched && <IconCheck size={14} className="text-white" />}
            <span className="font-normal">
              {isWatched ? 'Watched' : 'Mark watched'}
            </span>
          </button>
        </div>
      </div>

      {/* Desktop Layout (>= md) */}
      <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: '3fr 6fr 2fr 1fr' }}>
        {/* Column 1: Time (Dominant) */}
        <div className="flex flex-col justify-center">
          <div
            className="font-bold text-gray-900 leading-none"
            style={{ fontSize: '28px' }}
          >
            {startTime}
          </div>
          <div
            className="font-normal text-gray-400 my-1 leading-none"
            style={{ fontSize: '28px' }}
          >
            —
          </div>
          <div
            className="font-bold text-gray-900 leading-none"
            style={{ fontSize: '28px' }}
          >
            {endTime}
          </div>
        </div>

        {/* Column 2: Content Info */}
        <div className="flex flex-col justify-center">
          <h2
            className="font-medium text-gray-900 leading-tight mb-1"
            style={{
              fontSize: QuietDesign.typography.sizes.title,
              lineHeight: QuietDesign.typography.lineHeights.compact,
            }}
          >
            {title}
          </h2>
          {queueItem?.type === 'show' && season !== null && episode !== null && (
            <div
              className="text-gray-500 mb-1"
              style={{ fontSize: QuietDesign.typography.sizes.body }}
            >
              S{String(season).padStart(2, '0')}E{String(episode).padStart(2, '0')}
              {episodeTitle && ` • ${episodeTitle}`}
            </div>
          )}
          <div
            className="flex items-center gap-2 text-gray-400"
            style={{ fontSize: QuietDesign.typography.sizes.metadata }}
          >
            <span>{queueItem?.type === 'movie' ? 'Movie' : 'TV Show'}</span>
            {rating && (
              <>
                <span>•</span>
                <span>{rating}</span>
              </>
            )}
            <span>•</span>
            <span>{durationMinutes} min</span>
          </div>
        </div>

        {/* Column 3: Poster (De-emphasized) */}
        <div className="flex items-center justify-end">
          {queueItem?.posterUrl && (
            <img
              src={queueItem.posterUrl}
              alt=""
              className={`object-cover ${isWatched ? 'grayscale' : ''}`}
              style={{
                width: QuietDesign.poster.card.width,
                height: QuietDesign.poster.card.height,
                borderRadius: QuietDesign.borders.radius.poster,
              }}
            />
          )}
        </div>

        {/* Column 4: Watched Toggle */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleToggleWatched}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all
              ${
                isWatched
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-gray-300 hover:border-blue-500 text-gray-600 hover:text-blue-500'
              }
            `}
            style={{
              fontSize: QuietDesign.typography.sizes.metadata,
              transition: QuietDesign.transitions.fast,
            }}
            aria-label={isWatched ? `Mark as unwatched: ${title}` : `Mark as watched: ${title}`}
            aria-checked={isWatched}
          >
            {isWatched && <IconCheck size={14} className="text-white" />}
            <span className="font-normal whitespace-nowrap">
              {isWatched ? 'Watched' : 'Mark watched'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
