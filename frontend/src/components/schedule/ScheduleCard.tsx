import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScheduleCardItem, QueueCardItem } from './scheduleCardAdapters';
import { markAsWatched } from '../../api/schedule';
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
    mutationFn: () => markAsWatched(scheduleItem.id),
    onSuccess: () => {
      setIsWatched(true);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
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

  const handleMarkWatched = () => {
    if (!isWatched) {
      watchedMutation.mutate();
    }
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

        {/* Poster + Checkbox Inline */}
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
            onClick={handleMarkWatched}
            disabled={isWatched}
            className={`
              flex items-center justify-center rounded-full border-2 transition-all
              ${
                isWatched
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-300 hover:border-blue-500'
              }
            `}
            style={{
              width: QuietDesign.checkbox.size,
              height: QuietDesign.checkbox.size,
              transition: QuietDesign.transitions.fast,
            }}
            aria-label={`Mark as watched: ${title}`}
            aria-checked={isWatched}
          >
            {isWatched && (
              <IconCheck size={Number(QuietDesign.checkbox.iconSize)} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Desktop Layout (>= md) */}
      <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: '3fr 6fr 2fr 1fr' }}>
        {/* Column 1: Time (Dominant) */}
        <div className="flex flex-col justify-center">
          <div
            className="font-bold text-gray-900 leading-none"
            style={{ fontSize: QuietDesign.typography.sizes.time }}
          >
            {startTime}
          </div>
          <div
            className="font-normal text-gray-400 my-1 leading-none"
            style={{ fontSize: QuietDesign.typography.sizes.time }}
          >
            —
          </div>
          <div
            className="font-bold text-gray-900 leading-none"
            style={{ fontSize: QuietDesign.typography.sizes.time }}
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

        {/* Column 4: Mark Watched Checkbox */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleMarkWatched}
            disabled={isWatched}
            className={`
              flex items-center justify-center rounded-full border-2 transition-all
              ${
                isWatched
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-300 hover:border-blue-500'
              }
            `}
            style={{
              width: QuietDesign.checkbox.size,
              height: QuietDesign.checkbox.size,
              transition: QuietDesign.transitions.fast,
            }}
            aria-label={`Mark as watched: ${title}`}
            aria-checked={isWatched}
          >
            {isWatched && (
              <IconCheck size={Number(QuietDesign.checkbox.iconSize)} className="text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
