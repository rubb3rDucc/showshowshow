interface ProgressBarProps {
  title: string;
  posterUrl: string | null;
  episodesWatched: number;
  totalEpisodes: number;
  percentage: number;
}

export function ProgressBar({ title, posterUrl, episodesWatched, totalEpisodes, percentage }: ProgressBarProps) {
  return (
    <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm dark:shadow-gray-950/50 p-4 flex items-center gap-4">
      {/* Poster */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt={title}
          className="w-16 h-24 object-cover rounded-md border border-[rgb(var(--color-border-default))]"
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-[rgb(var(--color-text-primary))] mb-2 truncate">
          {title}
        </h3>

        {/* Progress Bar */}
        <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          <div
            className="absolute top-0 left-0 h-full bg-[rgb(var(--color-accent))] transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Episode Count */}
        <div className="text-xs font-normal text-[rgb(var(--color-text-secondary))]">
          {episodesWatched} / {totalEpisodes} episodes • {percentage}%
        </div>
      </div>
    </div>
  );
}
