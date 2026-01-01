import { useState, useEffect } from 'react';
import { TextInput, Select, Button, Group, Modal } from '@mantine/core';
import { Search, X, SlidersHorizontal } from 'lucide-react';

interface NetworkSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onClear: () => void;
}

export interface SearchFilters {
  query: string;
  sortBy: 'popularity' | 'rating' | 'recent' | 'alphabetical';
  decade?: string;
  minRating?: number;
}

export function NetworkSearch({ onSearch, onClear }: NetworkSearchProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SearchFilters['sortBy']>('popularity');
  const [decade, setDecade] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSearch = () => {
    onSearch(query, {
      query,
      sortBy,
      decade: decade || undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
    });
    // Close modal on mobile after search
    if (isMobile) {
      setSearchModalOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSortBy('popularity');
    setDecade(null);
    setMinRating(null);
    onClear();
    if (isMobile) {
      setSearchModalOpen(false);
    }
  };

  const hasActiveFilters = query || sortBy !== 'popularity' || decade || minRating;

  // Search form content (reusable for both desktop and mobile)
  const searchForm = (
    <>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <TextInput
          placeholder="Search shows within this network..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          leftSection={<Search size={16} />}
          className="flex-1"
          classNames={{
            input: 'border-2 border-gray-900 font-mono',
          }}
          autoFocus={isMobile && searchModalOpen}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-2 border-gray-900 font-black uppercase"
            onClick={() => setShowFilters(!showFilters)}
            leftSection={<SlidersHorizontal size={16} />}
          >
            Filters
          </Button>
          <Button
            className="bg-black text-white border-2 border-black font-black uppercase hover:bg-gray-900"
            onClick={handleSearch}
          >
            Search
          </Button>
          {hasActiveFilters && (
            <Button
              variant="subtle"
              onClick={handleClear}
              leftSection={<X size={16} />}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="pt-3 border-t-2 border-gray-200">
          <Group gap="md">
            <Select
              label="Sort By"
              value={sortBy}
              onChange={(value) => setSortBy(value as SearchFilters['sortBy'])}
              data={[
                { value: 'popularity', label: 'Most Popular' },
                { value: 'rating', label: 'Highest Rated' },
                { value: 'recent', label: 'Most Recent' },
                { value: 'alphabetical', label: 'A-Z' },
              ]}
              className="flex-1"
              classNames={{
                input: 'border-2 border-gray-900 font-mono',
              }}
            />
            <Select
              label="Decade"
              placeholder="Any decade"
              value={decade}
              onChange={setDecade}
              data={[
                { value: '1980s', label: '1980s' },
                { value: '1990s', label: '1990s' },
                { value: '2000s', label: '2000s' },
                { value: '2010s', label: '2010s' },
                { value: '2020s', label: '2020s' },
              ]}
              clearable
              className="flex-1"
              classNames={{
                input: 'border-2 border-gray-900 font-mono',
              }}
            />
            <Select
              label="Min Rating"
              placeholder="Any rating"
              value={minRating}
              onChange={setMinRating}
              data={[
                { value: '7.0', label: '7.0+' },
                { value: '7.5', label: '7.5+' },
                { value: '8.0', label: '8.0+' },
                { value: '8.5', label: '8.5+' },
                { value: '9.0', label: '9.0+' },
              ]}
              clearable
              className="flex-1"
              classNames={{
                input: 'border-2 border-gray-900 font-mono',
              }}
            />
          </Group>
        </div>
      )}
    </>
  );

  // Mobile: Show button to open modal
  if (isMobile) {
    return (
      <>
        <div className="mb-6">
          <Button
            className="bg-black text-white border-2 border-black font-black uppercase hover:bg-gray-900 w-full"
            onClick={() => setSearchModalOpen(true)}
            leftSection={<Search size={16} />}
          >
            {hasActiveFilters ? `Search: ${query || 'Filtered'}` : 'Search Shows'}
          </Button>
        </div>

        <Modal
          opened={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          title="Search Shows"
          size="lg"
          padding={0}
          withCloseButton={false}
          classNames={{
            content: 'border-4 border-gray-900 font-mono',
            body: 'p-0',
          }}
        >
          <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-gray-900">
            <h2 className="text-lg font-black uppercase tracking-tight">
              Search Shows
            </h2>
            <button
              onClick={() => setSearchModalOpen(false)}
              className="hover:opacity-70 transition-opacity"
            >
              <X size={24} strokeWidth={3} />
            </button>
          </div>
          <div className="p-4">
            {searchForm}
          </div>
        </Modal>
      </>
    );
  }

  // Desktop: Show regular search bar
  return (
    <div className="bg-white border-2 border-gray-900 p-4 mb-6">
      {searchForm}
    </div>
  );
}


