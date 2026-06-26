import { Check } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { formatWatchTime } from '../../utils/format';
import { formatLastWatched } from '../../utils/library.utils';
import { getWeeklyStats } from '../../api/library';
import type { WeeklyActivityItem } from '../../types/library.types';

function deltaNode(cur: number, prev: number, format?: (n: number) => string) {
  const d = cur - prev;
  if (d === 0) {
    return <span className="text-[10px] text-[rgb(var(--color-text-tertiary))]">–</span>;
  }
  const up = d > 0;
  const fmt = format ?? ((n: number) => String(n));
  return (
    <span
      className={`text-[10px] font-medium ${
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
      }`}
    >
      {up ? '▲' : '▼'} {fmt(Math.abs(d))}
    </span>
  );
}

function StatTile({
  value,
  label,
  delta,
}: {
  value: string;
  label: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-2 px-1">
      <span className="text-lg font-medium text-[rgb(var(--color-text-primary))]">{value}</span>
      <span className="text-[10px] text-[rgb(var(--color-text-tertiary))] mt-0.5">{label}</span>
      {delta && <span className="mt-0.5 leading-none">{delta}</span>}
    </div>
  );
}

function ActivityRow({
  item,
  onNavigate,
}: {
  item: WeeklyActivityItem;
  onNavigate: (contentId: string) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(item.content_id)}
      className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-[rgb(var(--color-bg-page))] -mx-2 px-2 rounded transition-colors cursor-pointer"
    >
      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white bg-emerald-600">
        <Check size={12} />
      </span>
      <span className="flex-1 min-w-0 text-sm text-[rgb(var(--color-text-primary))] truncate">
        Finished {item.title}
      </span>
      <span className="flex-shrink-0 text-[11px] text-[rgb(var(--color-text-tertiary))]">
        {formatLastWatched(item.timestamp).toLowerCase()}
      </span>
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg p-4">
      <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-3">This week</h3>
      {children}
    </div>
  );
}

export function Recap() {
  const [, setLocation] = useLocation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['library', 'stats', 'weekly'],
    queryFn: getWeeklyStats,
    staleTime: 60_000,
  });

  const handleNavigate = (contentId: string) => setLocation(`/library?open=${contentId}`);

  if (isLoading) {
    return (
      <Card>
        <div className="grid grid-cols-4 gap-1 mb-3 pb-3 border-b border-[rgb(var(--color-border-subtle))]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 py-2 animate-pulse">
              <div className="h-5 w-8 rounded bg-[rgb(var(--color-border-default))]" />
              <div className="h-2.5 w-10 rounded bg-[rgb(var(--color-border-default))]" />
            </div>
          ))}
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 w-3/4 rounded bg-[rgb(var(--color-border-default))]" />
          <div className="h-4 w-2/3 rounded bg-[rgb(var(--color-border-default))]" />
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">Couldn’t load this week.</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm font-medium text-[#646cff] hover:underline cursor-pointer"
        >
          Try again
        </button>
      </Card>
    );
  }

  const { episodes_watched, movies_watched, watch_minutes, finished, active_days, previous, recent_activity } = data;
  const watchedCur = episodes_watched + movies_watched;
  const watchedPrev = previous.episodes_watched + previous.movies_watched;
  const allZero = watchedCur === 0 && watch_minutes === 0 && finished === 0;

  return (
    <Card>
      <div className="grid grid-cols-4 gap-1 mb-3 pb-3 border-b border-[rgb(var(--color-border-subtle))]">
        <StatTile
          value={String(watchedCur)}
          label="Watched"
          delta={deltaNode(watchedCur, watchedPrev)}
        />
        <StatTile
          value={formatWatchTime(watch_minutes)}
          label="Watch time"
          delta={deltaNode(watch_minutes, previous.watch_minutes, formatWatchTime)}
        />
        <StatTile
          value={String(finished)}
          label="Finished"
          delta={deltaNode(finished, previous.finished)}
        />
        <StatTile value={`${active_days}/7`} label="Active days" />
      </div>

      {recent_activity.length > 0 ? (
        <>
          <h4 className="text-[10px] font-medium text-[rgb(var(--color-text-tertiary))] tracking-wider uppercase mb-1">
            Recent activity
          </h4>
          <div className="divide-y divide-[rgb(var(--color-border-subtle))]">
            {recent_activity.map((a) => (
              <ActivityRow key={a.content_id} item={a} onNavigate={handleNavigate} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {allZero ? 'Nothing watched this week yet.' : 'No titles finished this week.'}
        </p>
      )}

      <button
        onClick={() => setLocation('/stats')}
        className="mt-3 text-xs text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))] transition-colors cursor-pointer"
      >
        view full stats
      </button>
    </Card>
  );
}
