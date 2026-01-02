import { ChevronRight } from 'lucide-react';
import { ContentCard } from './ContentCard';

type ContentItem = {
  id: number;
  title: string;
  poster_url: string | null;
  vote_average?: number;
  first_air_date?: string;
};

interface ContentCarouselProps<T extends ContentItem = ContentItem> {
  items: T[];
  onItemClick: (item: T) => void;
}

export function ContentCarousel<T extends ContentItem = ContentItem>({ items, onItemClick }: ContentCarouselProps<T>) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm font-mono">No content available</p>
      </div>
    );
  }

  return (
    <div className="relative">
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-4 pb-4">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))}
          {/* Peek indicator - show partial next card if there are more items */}
          {items.length > 6 && (
            <div className="flex-shrink-0 w-8 flex items-center justify-center opacity-50">
              <ChevronRight className="text-gray-400" size={24} />
            </div>
          )}
        </div>
      </div>
      {/* Gradient fade on right edge */}
      <div className="absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none hidden md:block" />
    </div>
  );
}

