import { Star } from 'lucide-react';
import { LazyImage } from './LazyImage';

interface ContentCardProps {
  item: {
    id: number;
    title: string;
    poster_url: string | null;
    vote_average?: number;
    first_air_date?: string;
  };
  onClick: () => void;
}

export function ContentCard({ item, onClick }: ContentCardProps) {
  return (
    <div
      className="flex-shrink-0 w-40 cursor-pointer group relative"
      onClick={onClick}
    >
      <div className="relative overflow-hidden rounded-lg">
      {item.poster_url ? (
        <LazyImage
          src={item.poster_url}
          alt={item.title}
            className="w-full h-60 object-cover rounded-lg shadow-sm dark:shadow-gray-950/50 hover:shadow-xl dark:hover:shadow-gray-950/80 transition-transform duration-500 ease-out group-hover:scale-110"
        />
      ) : (
          <div className="w-full h-60 bg-[rgb(var(--color-bg-elevated))] dark:bg-gray-800 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out">
          <span className="text-xs font-semibold text-[rgb(var(--color-text-tertiary))] text-center px-2">
            NO IMAGE
          </span>
        </div>
      )}
        {/* Overlay on hover (desktop only) */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 hidden md:flex rounded-lg">
          <div className="text-white text-center px-2">
            <p className="font-semibold text-sm mb-1">{item.title}</p>
            {item.vote_average && (
              <div className="flex items-center justify-center gap-1">
                <Star size={14} fill="white" />
                <span className="text-xs">{item.vote_average.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate group-hover:text-[rgb(var(--color-text-secondary))] transition-colors">
        {item.title}
      </p>
      {item.vote_average && (
        <div className="flex items-center gap-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
          <Star size={12} fill="currentColor" />
          <span>{item.vote_average.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
