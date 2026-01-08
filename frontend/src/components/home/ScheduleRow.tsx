import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { markAsWatched, unmarkAsWatched } from '../../api/schedule';
import type { ScheduleItem } from '../../types/api';
import { getWaveStyle } from '../../hooks/useWaveEffect';

interface ScheduleRowProps {
  item: ScheduleItem;
  distanceFromHovered?: number; // Signed distance from hovered row: -2, -1, 0, 1, 2
  isHoveredActive?: boolean;    // Whether any row in the list is being hovered
  isSettling?: boolean;         // Whether wave is settling back down
}

export function ScheduleRow({ item, distanceFromHovered = 0, isHoveredActive = false, isSettling = false }: ScheduleRowProps) {
  const queryClient = useQueryClient();

  const watchedMutation = useMutation({
    mutationFn: (nextWatched: boolean) =>
      nextWatched ? markAsWatched(item.id) : unmarkAsWatched(item.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['schedule'] });
      return { prevWatched: item.watched };
    },
    onSuccess: (_data, nextWatched) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'], exact: false });
      toast.success(nextWatched ? `Watched ${item.title}` : `Unwatched ${item.title}`);
    },
    onError: () => {
      toast.error('Failed to update watch status');
    },
  });

  const handleToggleWatched = () => {
    watchedMutation.mutate(!item.watched);
  };

  // Format time
  const startTime = new Date(item.scheduled_time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Format season/episode if show
  const episodeInfo = item.content_type === 'show' && item.season !== null && item.episode !== null
    ? `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`
    : null;

  // Opacity: 100% for unwatched, 30% + grayscale for watched (per design guidelines)
  const opacityClass = item.watched ? 'opacity-30 grayscale' : '';

  // Wave effect - uses shared config from useWaveEffect
  const waveStyle = getWaveStyle(distanceFromHovered, isHoveredActive, isSettling);

  return (
    <div
      className={`
        schedule-row
        flex items-center gap-3 py-2
        transition-transform duration-300
        ${opacityClass}
      `}
      style={waveStyle}
    >
      {/* Watched toggle circle - higher contrast, clickable */}
      <button
        onClick={handleToggleWatched}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors cursor-pointer ${
          item.watched
            ? 'bg-[#646cff] border-[#646cff]'
            : 'border-[rgb(var(--color-text-secondary))] hover:border-[#646cff]'
        }`}
        aria-label={item.watched ? `Mark as unwatched: ${item.title}` : `Mark as watched: ${item.title}`}
        aria-pressed={item.watched}
      />

      {/* Time - 20px per design guidelines, w-24 to fit "10:00 PM" */}
      <span className="flex-shrink-0 w-24 text-xl font-medium text-[rgb(var(--color-text-primary))] whitespace-nowrap">
        {startTime}
      </span>

      {/* Title and episode info - 16px per design guidelines */}
      <div className="flex-1 min-w-0">
        <span className="text-base text-[rgb(var(--color-text-primary))] truncate block">
          {item.title}
        </span>
        {episodeInfo && (
          <span className="text-xs text-[rgb(var(--color-text-tertiary))] truncate block">
            {episodeInfo}{item.episode_title ? ` · ${item.episode_title}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
