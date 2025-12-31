interface ProgressBarProps {
  title: string;
  posterUrl: string | null;
  episodesWatched: number;
  totalEpisodes: number;
  percentage: number;
}

export function ProgressBar({ title, posterUrl, episodesWatched, totalEpisodes, percentage }: ProgressBarProps) {
  return (
    <div className="bg-white border-2 border-gray-900 p-4 flex items-center gap-4">
      {/* Poster */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt={title}
          className="w-16 h-24 object-cover border-2 border-gray-900"
        />
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-sm uppercase tracking-wider mb-2 truncate">
          {title}
        </h3>
        
        {/* Progress Bar */}
        <div className="relative w-full h-6 bg-gray-200 border-2 border-gray-900 mb-2">
          <div
            className="absolute top-0 left-0 h-full bg-green-400 transition-all"
            style={{ width: `${percentage}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-black uppercase tracking-wider text-gray-900">
              {percentage}%
            </span>
          </div>
        </div>
        
        {/* Episode Count */}
        <div className="text-xs font-mono font-black uppercase tracking-wider text-gray-600">
          {episodesWatched} / {totalEpisodes} episodes
        </div>
      </div>
    </div>
  );
}

