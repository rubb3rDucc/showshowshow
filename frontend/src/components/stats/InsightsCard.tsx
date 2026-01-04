import { Lightbulb } from 'lucide-react';

interface InsightsCardProps {
  completionRate: number;
  totalWatchTimeHours: number;
  totalEpisodesWatched: number;
}

export function InsightsCard({ completionRate, totalWatchTimeHours, totalEpisodesWatched }: InsightsCardProps) {
  return (
    <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm dark:shadow-gray-950/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Lightbulb size={20} className="text-[rgb(var(--color-text-secondary))]" />
        <span className="text-lg font-semibold text-[rgb(var(--color-text-primary))] tracking-tight">
          Viewing Insights
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-[rgb(var(--color-border-subtle))]">
          <span className="text-sm font-normal text-[rgb(var(--color-text-secondary))]">Completion Rate</span>
          <span className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">{completionRate}%</span>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-[rgb(var(--color-border-subtle))]">
          <span className="text-sm font-normal text-[rgb(var(--color-text-secondary))]">Total Watch Time</span>
          <span className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">{totalWatchTimeHours}h</span>
        </div>

        <div className="flex items-center justify-between py-3">
          <span className="text-sm font-normal text-[rgb(var(--color-text-secondary))]">Episodes Watched</span>
          <span className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">{totalEpisodesWatched}</span>
        </div>
      </div>
    </div>
  );
}

