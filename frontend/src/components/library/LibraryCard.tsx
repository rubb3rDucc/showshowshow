import { Star, Tv } from 'lucide-react';
import type { LibraryItemUI, LibraryStatus } from '../../types/library.types';

interface LibraryCardProps {
  item: LibraryItemUI;
  onViewDetails: (item: LibraryItemUI) => void; // View details modal     
  onChangeStatus: (item: LibraryItemUI) => void;  // Change status
  onSave: (updates: Partial<LibraryItemUI>) => void;  // Save changes
  onAddToQueue: (item: LibraryItemUI) => void;  // Add to queue
  onRemove: (id: string) => void;  // Remove from library
}

const STATUS_COLORS: Record<LibraryStatus, { 
  bg: string; 
  text: string; 
  border: string;
  label: string;
}> = {
  watching: {
    bg: 'bg-blue-500/90',
    text: 'text-white',
    border: 'border-blue-500',
    label: 'Watching',
  },
  completed: {
    bg: 'bg-green-500/90',
    text: 'text-white',
    border: 'border-green-500',
    label: 'Completed',
  },
  dropped: {
    bg: 'bg-red-500/90',
    text: 'text-white',
    border: 'border-red-500',
    label: 'Dropped',
  },
  plan_to_watch: {
    bg: 'bg-gray-500/90',
    text: 'text-white',
    border: 'border-gray-500',
    label: 'Plan to Watch',
  },
};


export function LibraryCard({
  item,
  onViewDetails,
}: LibraryCardProps) {
  const statusStyle = STATUS_COLORS[item.status];
  // const hasProgress = item.progress && item.progress.percentage > 0;

  return (
    <div 
      className="group cursor-pointer"
      onClick={() => onViewDetails(item)}
    >
      {/* Poster Card - Apple-inspired */}
      <div 
        className="relative aspect-[2/3] overflow-hidden rounded-lg 
                   bg-gray-100 
                   shadow-sm hover:shadow-xl 
                   transition-all duration-300 ease-out
                   transform hover:-translate-y-1
                   border-2"
        style={{
          borderColor: statusStyle.border === 'border-blue-500' ? 'rgba(59, 130, 246, 0.3)' :
                       statusStyle.border === 'border-green-500' ? 'rgba(34, 197, 94, 0.3)' :
                       statusStyle.border === 'border-red-500' ? 'rgba(239, 68, 68, 0.3)' :
                       'rgba(107, 114, 128, 0.3)',
        }}
        onMouseEnter={(e) => {
          const color = statusStyle.border === 'border-blue-500' ? 'rgba(59, 130, 246, 0.6)' :
                        statusStyle.border === 'border-green-500' ? 'rgba(34, 197, 94, 0.6)' :
                        statusStyle.border === 'border-red-500' ? 'rgba(239, 68, 68, 0.6)' :
                        'rgba(107, 114, 128, 0.6)';
          e.currentTarget.style.borderColor = color;
        }}
        onMouseLeave={(e) => {
          const color = statusStyle.border === 'border-blue-500' ? 'rgba(59, 130, 246, 0.3)' :
                        statusStyle.border === 'border-green-500' ? 'rgba(34, 197, 94, 0.3)' :
                        statusStyle.border === 'border-red-500' ? 'rgba(239, 68, 68, 0.3)' :
                        'rgba(107, 114, 128, 0.3)';
          e.currentTarget.style.borderColor = color;
        }}
      >
        {/* Poster Image */}
        {item.content.posterUrl ? (
          <img
            src={item.content.posterUrl}
            alt={item.content.title}
            className="w-full h-full object-cover 
                       transition-transform duration-500 ease-out
                       group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center 
                          bg-gradient-to-br from-gray-100 to-gray-200">
            <Tv className="w-12 h-12 text-gray-400" />
          </div>
        )}

        {/* Subtle Status Badge - Top Left */}
        <div className="absolute top-2 left-2">
          <div className={`
            px-2 py-0.5 rounded-md
            ${statusStyle.bg}
            ${statusStyle.text}
            backdrop-blur-md
            text-[10px] font-medium
            shadow-lg
          `}>
            {statusStyle.label}
          </div>
        </div>


        {/* Progress Overlay - Lighter, More Elegant */}
        {item.content.contentType === 'show' && item.progress && (
          <div className="absolute bottom-0 left-0 right-0 
                          bg-gradient-to-t from-black/60 via-black/40 to-transparent 
                          p-2.5">
            <div className="flex items-center justify-between text-white mb-1.5">
              <span className="text-[11px] font-medium tracking-wide">
                {item.progress.episodesWatched}/{item.progress.totalEpisodes}
              </span>
              <span className="text-[11px] font-medium">
                {item.progress.percentage}%
              </span>
            </div>
            {/* Refined progress bar */}
            <div className="h-0.5 bg-[rgb(var(--color-bg-surface))]/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-[rgb(var(--color-bg-surface))]/90 transition-all duration-500 ease-out"
                style={{ width: `${item.progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Card Info - Cleaner Hierarchy */}
      <div className="mt-3 space-y-1.5">
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 
                       line-clamp-2 
                       leading-snug
                       group-hover:text-gray-700 
                       transition-colors">
          {item.content.title}
        </h3>

        {/* Metadata - Better Visual Separation */}
        <div className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-tertiary))]">
          {/* Type badge */}
          <span className="px-1.5 py-0.5 rounded 
                           bg-gray-100 text-gray-600 
                           font-medium">
            {item.content.contentType === 'movie' ? 'Film' : 'TV'}
          </span>
          
          {/* Progress for shows */}
          {item.content.contentType === 'show' && item.progress && (
            <>
              <span className="text-gray-300">•</span>
              <span className="font-medium">
                {item.progress.episodesWatched}/{item.progress.totalEpisodes}
              </span>
            </>
          )}
          
          {/* Rating */}
          {item.score && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-0.5">
                <Star size={10} fill="currentColor" className="text-amber-500" />
                <span className="font-medium">{item.score}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
