import { memo } from 'react';
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

export const ContentCard = memo(function ContentCard({ item, onClick }: ContentCardProps) {
  return (
    <div
      className="flex-shrink-0 w-40 cursor-pointer group"
      onClick={onClick}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-lg
                   bg-gray-100
                   shadow-sm hover:shadow-xl
                   transition-all duration-300 ease-out
                   hover:-translate-y-1
                   border-2"
        style={{
          borderColor: 'rgba(107, 114, 128, 0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
        }}
      >
      {item.poster_url ? (
        <LazyImage
          src={item.poster_url}
          alt={item.title}
            className="w-full h-full object-cover
                       transition-transform duration-500 ease-out
                       group-hover:scale-110"
        />
      ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <span className="text-xs font-semibold text-gray-400 text-center px-2">
            NO IMAGE
          </span>
        </div>
      )}
      </div>
      <p className="mt-2 text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate group-hover:text-gray-700 transition-colors">
        {item.title}
      </p>
      {item.vote_average && (
        <div className="flex items-center gap-1 text-xs font-normal text-[rgb(var(--color-text-tertiary))]">
          <Star size={12} fill="currentColor" className="text-amber-500" />
          <span>{item.vote_average.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
});
