import { Badge } from '@mantine/core';
import { Star } from 'lucide-react';
import type { LibraryItemUI, LibraryStatus } from '../../types/library.types';

interface LibraryCardProps {
  item: LibraryItemUI;
  onViewDetails: (item: LibraryItemUI) => void;
  onChangeStatus: (item: LibraryItemUI) => void;
  onAddToQueue: (item: LibraryItemUI) => void;
  onRemove: (id: string) => void;
  onSave: (updates: Partial<LibraryItemUI>) => void;
}


const STATUS_STYLES: Record<LibraryStatus, { bg: string; text: string; label: string }> = {
  watching: {
    bg: 'bg-black',
    text: 'text-white',
    label: 'WATCHING',
  },
  completed: {
    bg: 'bg-black',
    text: 'text-white',
    label: 'COMPLETED',
  },
  dropped: {
    bg: 'bg-black',
    text: 'text-white',
    label: 'DROPPED',
  },
  plan_to_watch: {
    bg: 'bg-black',
    text: 'text-white',
    label: 'PLAN TO WATCH',
  },
};


export function LibraryCard({
  item,
  onViewDetails,
}: LibraryCardProps) {
  const statusStyle = STATUS_STYLES[item.status];

  return (
    <div 
      className="group cursor-pointer"
      onClick={() => onViewDetails(item)}
    >
      {/* Poster Card - Black/White/Grey Only */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-md shadow-md hover:shadow-xl transition-all duration-300 bg-gray-200 border border-gray-300">
        {/* Poster Image */}
        {item.content.posterUrl ? (
          <img
            src={item.content.posterUrl}
            alt={item.content.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-sm font-medium text-gray-500">NO IMAGE</span>
          </div>
        )}

        {/* Production Studio Label Overlay (Top) */}
        {/* <div className="absolute top-0 left-0 right-0 bg-black/80 backdrop-blur-sm px-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              {productionStudio}
            </span>
            <span className="text-[10px] font-medium text-white/80">
              hi-fi STEREO
            </span>
          </div>
        </div> */}

        {/* Status Badge (Top Right) */}
        <div className="absolute top-2 right-2">
          <Badge
            className={`${statusStyle.bg} ${statusStyle.text} text-[10px] font-semibold px-2 py-0.5 shadow-lg`}
            size="sm"
            radius="xs"
          >
            {statusStyle.label}
          </Badge>
        </div>

        {/* Progress Overlay (Bottom) - for TV Shows */}
        {item.content.contentType === 'show' && item.progress && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3">
            <div className="flex items-center justify-between text-white mb-1">
              <span className="text-xs font-semibold">
                {item.progress.episodesWatched}/{item.progress.totalEpisodes} EP
              </span>
              <span className="text-xs font-semibold">
                {item.progress.percentage}%
              </span>
            </div>
            {/* Progress Bar - Grey */}
            <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-300 transition-all duration-300"
                style={{ width: `${item.progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Rating Overlay (Bottom Right) - if scored */}
        {/* {item.score && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded">
            <Star size={12} fill="currentColor" className="text-yellow-400" />
            <span className="text-xs font-semibold text-white">{item.score}/10</span>
          </div>
        )} */}
      </div>

      {/* Card Info Below Poster */}
      <div className="mt-2 space-y-1">
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-gray-600 transition-colors">
          {item.content.title}
        </h3>

        {/* Metadata Row */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-medium">
            {item.content.contentType === 'movie' ? 'FILM' : 'TV'}
          </span>
          {item.content.contentType === 'show' && item.progress && (
            <>
              <span>•</span>
              <span>{item.progress.episodesWatched}/{item.progress.totalEpisodes} EP</span>
            </>
          )}
          {item.score && (
            <>
              <span>•</span>
              <div className="flex items-center gap-0.5">
                <Star size={10} fill="currentColor" className="text-yellow-500" />
                <span>{item.score}/10</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
