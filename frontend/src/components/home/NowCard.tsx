import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { markAsWatched, unmarkAsWatched } from '../../api/schedule';
import type { ScheduleItem } from '../../types/api';

interface NowCardProps {
  item: ScheduleItem;
}

export function NowCard({ item }: NowCardProps) {
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

  // Calculate progress
  const now = new Date();
  const startTime = new Date(item.scheduled_time);
  const endTime = new Date(startTime.getTime() + (item.duration || 30) * 60000);
  const totalDuration = endTime.getTime() - startTime.getTime();
  const elapsed = now.getTime() - startTime.getTime();
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  // Format time
  const formattedTime = startTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Format season/episode if show
  const episodeInfo = item.content_type === 'show' && item.season !== null && item.episode !== null
    ? `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`
    : null;

  return (
    <div
      className={`
        w-full text-left
        rounded-lg p-6
        bg-[rgb(var(--color-bg-surface))]
        border-2 border-[rgb(var(--color-border-default))]
        shadow-sm
        ${item.watched ? 'opacity-30 grayscale' : 'opacity-100'}
      `}
    >
      {/* Time - 20px medium per design guidelines */}
      <div className="text-xl font-medium text-[rgb(var(--color-text-primary))] mb-2">
        {formattedTime}
      </div>

      {/* Title - 24px medium per design guidelines */}
      <h2 className="text-2xl font-medium text-[rgb(var(--color-text-primary))] mb-1">
        {item.title}
      </h2>

      {/* Episode info with title */}
      {episodeInfo && (
        <div className="text-base text-[rgb(var(--color-text-tertiary))] mb-5">
          {episodeInfo}{item.episode_title ? ` · ${item.episode_title}` : ''}
        </div>
      )}

      {/* Progress bar - slightly thicker for visibility */}
      <div className="h-1 bg-[rgb(var(--color-border-subtle))] rounded-full mb-5">
        <div
          className="h-full bg-[#646cff] rounded-full transition-all duration-1000"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Watched indicator in bottom-right - larger circle for NowCard */}
      <div className="flex justify-end">
        <button
          onClick={handleToggleWatched}
          className={`flex items-center gap-2.5 cursor-pointer ${
            item.watched
              ? 'text-[rgb(var(--color-text-tertiary))]'
              : 'text-[rgb(var(--color-text-primary))]'
          }`}
          aria-label={item.watched ? `Mark as unwatched: ${item.title}` : `Mark as watched: ${item.title}`}
          aria-pressed={item.watched}
        >
          <span
            className={`w-6 h-6 rounded-full border-2 transition-colors ${
              item.watched
                ? 'bg-[#646cff] border-[#646cff]'
                : 'border-[rgb(var(--color-text-primary))] hover:border-[#646cff]'
            }`}
            aria-hidden="true"
          />
          <span className="text-base font-medium">Watched</span>
        </button>
      </div>
    </div>
  );
}
