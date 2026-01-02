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
      <div className="relative overflow-hidden">
      {item.poster_url ? (
        <LazyImage 
          src={item.poster_url}
          alt={item.title}
            className="w-full h-60 object-cover border-2 border-gray-900 group-hover:border-4 transition-all group-hover:scale-105 group-hover:shadow-lg"
        />
      ) : (
          <div className="w-full h-60 bg-gray-200 border-2 border-gray-900 flex items-center justify-center group-hover:scale-105 transition-transform">
          <span className="text-xs font-black text-gray-600 text-center px-2">
            NO IMAGE
          </span>
        </div>
      )}
        {/* Overlay on hover (desktop only) */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 hidden md:flex">
          <div className="text-white text-center px-2">
            <p className="font-bold text-sm mb-1">{item.title}</p>
            {item.vote_average && (
              <div className="flex items-center justify-center gap-1">
                <Star size={14} fill="white" />
                <span className="text-xs">{item.vote_average.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm font-bold truncate group-hover:text-gray-600 transition-colors">
        {item.title}
      </p>
      {item.vote_average && (
        <div className="flex items-center gap-1 text-xs font-mono text-gray-600">
          <Star size={12} fill="currentColor" />
          <span>{item.vote_average.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

