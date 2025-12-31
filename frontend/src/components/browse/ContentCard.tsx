import { Star } from 'lucide-react';

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
      className="flex-shrink-0 w-40 cursor-pointer group"
      onClick={onClick}
    >
      {item.poster_url ? (
        <img 
          src={item.poster_url}
          alt={item.title}
          className="w-full h-60 object-cover border-2 border-gray-900 group-hover:border-4 transition-all"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-60 bg-gray-200 border-2 border-gray-900 flex items-center justify-center">
          <span className="text-xs font-black text-gray-600 text-center px-2">
            NO IMAGE
          </span>
        </div>
      )}
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

