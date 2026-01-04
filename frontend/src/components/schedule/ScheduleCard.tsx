import { useEffect, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ScheduleCardItem, QueueCardItem } from './scheduleCardAdapters';
import { markAsWatched, unmarkAsWatched } from '../../api/schedule';
import { normalizeRating } from '../../utils/rating';

interface ScheduleCardProps {
  scheduleItem: ScheduleCardItem;
  queueItem?: QueueCardItem;
  rowNumber: number;
  contentId?: string;
  isRerun?: boolean;
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
  contentId,
  isRerun,
  watched = false,
}: ScheduleCardProps) {
  const queryClient = useQueryClient();
  const [isWatched, setIsWatched] = useState(watched);

  useEffect(() => {
    setIsWatched(watched);
  }, [watched]);

  const watchedMutation = useMutation({
    mutationFn: (nextWatched: boolean) =>
      nextWatched ? markAsWatched(scheduleItem.id) : unmarkAsWatched(scheduleItem.id),
    onMutate: (nextWatched: boolean) => {
      // Optimistic update
      setIsWatched(nextWatched);
      return { prevWatched: isWatched };
    },
    onSuccess: (data, nextWatched) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'], exact: false });
      if (contentId) {
        queryClient.invalidateQueries({ queryKey: ['episode-statuses', contentId] });
      }
      queryClient.invalidateQueries({ queryKey: ['library'], exact: false });
      const timestamp = data?.watched_at ? new Date(data.watched_at).toLocaleString() : new Date().toLocaleString();
      const actionTitle = queueItem?.title || scheduleItem.title;
      toast.success(
        nextWatched
          ? `Watched ${actionTitle} at ${timestamp}`
          : `Unwatched ${actionTitle} at ${timestamp}`
      );
    },
    onError: (_error, _vars, context) => {
      // Revert on error
      setIsWatched(context?.prevWatched ?? watched);
      toast.error('Failed to update watch status');
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
    watchedMutation.mutate(!isWatched);
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
    >
      {/* Mobile Layout (< md) */}
      <div className="md:hidden flex flex-col gap-3">
        {/* Time (Dominant) */}
        <div className="flex items-center">
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {startTime}
          </div>
          <div className="text-3xl font-normal text-gray-400 leading-none" style={{ margin: '0 2px' }}>—</div>
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {endTime}
          </div>
          {isWatched && (
            <span
              className="text-xs text-gray-500 uppercase tracking-wide"
              style={{ letterSpacing: '0.08em' }}
            >
              Watched
            </span>
          )}
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
            {!isWatched && isRerun && (
              <>
                <span>•</span>
                <span>Rerun</span>
              </>
            )}
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
                borderRadius: '6px',
              }}
            />
          )}
          <button
            onClick={handleToggleWatched}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs transition-colors ${
              isWatched
                ? 'bg-gray-900 border-gray-900 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600'
            }`}
            aria-label={isWatched ? `Mark as unwatched: ${title}` : `Mark as watched: ${title}`}
            aria-checked={isWatched}
          >
            {isWatched && <IconCheck size={14} style={{ color: 'white' }} />}
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
            className="font-normal text-gray-400 leading-none"
            style={{ fontSize: '28px', margin: '0' }}
          >
            —
          </div>
          <div
            className="font-bold text-gray-900 leading-none"
            style={{ fontSize: '28px' }}
          >
            {endTime}
          </div>
          {isWatched && (
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1.5">
              Watched
            </div>
          )}
        </div>

        {/* Column 2: Content Info */}
        <div className="flex flex-col justify-center">
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
            {!isWatched && isRerun && (
              <>
                <span>•</span>
                <span>Rerun</span>
              </>
            )}
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
                width: '56px',
                height: '80px',
                borderRadius: '6px',
              }}
            />
          )}
        </div>

        {/* Column 4: Watched Toggle */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleToggleWatched}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs transition-colors ${
              isWatched
                ? 'bg-gray-900 border-gray-900 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600'
            }`}
            aria-label={isWatched ? `Mark as unwatched: ${title}` : `Mark as watched: ${title}`}
            aria-checked={isWatched}
          >
            {isWatched && <IconCheck size={14} style={{ color: 'white' }} />}
            <span className="font-normal whitespace-nowrap">
              {isWatched ? 'Watched' : 'Mark watched'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
