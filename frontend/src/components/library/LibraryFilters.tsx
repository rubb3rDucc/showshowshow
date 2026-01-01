import { TextInput, Select } from '@mantine/core';
import { Search } from 'lucide-react';
import type {
  LibraryFilterStatus,
  LibraryFilterType,
  LibrarySortOption,
} from '../../types/library.types';

interface LibraryFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: LibraryFilterStatus;
  onFilterStatusChange: (value: LibraryFilterStatus) => void;
  filterType: LibraryFilterType;
  onFilterTypeChange: (value: LibraryFilterType) => void;
  sortBy: LibrarySortOption;
  onSortChange: (value: LibrarySortOption) => void;
}

export function LibraryFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterType,
  onFilterTypeChange,
  sortBy,
  onSortChange,
}: LibraryFiltersProps) {
  return (
    <div className="space-y-4 mb-6">
      {/* Search Bar */}
      <div className="bg-white border-1 border-gray-800 font-mono">
        <TextInput
          placeholder="SEARCH LIBRARY..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftSection={<Search size={16} className="text-gray-900" />}
          size="md"
          classNames={{
            input:
              'border-0 font-mono font-black uppercase tracking-wider placeholder:font-black',
          }}
        />
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Status Filter */}
        <Select
          data={[
            {
              value: 'all',
              label: 'ALL STATUS',
            },
            {
              value: 'watching',
              label: 'WATCHING',
            },
            {
              value: 'completed',
              label: 'COMPLETED',
            },
            {
              value: 'dropped',
              label: 'DROPPED',
            },
            {
              value: 'plan_to_watch',
              label: 'PLAN TO WATCH',
            },
          ]}
          value={filterStatus}
          onChange={(value) =>
            onFilterStatusChange(value as LibraryFilterStatus)
          }
          classNames={{
            input:
              'border-2 border-gray-900 font-mono font-black uppercase text-xs',
          }}
        />

        {/* Type Filter */}
        <Select
          data={[
            {
              value: 'all',
              label: 'ALL TYPES',
            },
            {
              value: 'show',
              label: 'TV SHOWS',
            },
            {
              value: 'movie',
              label: 'MOVIES',
            },
          ]}
          value={filterType}
          onChange={(value) => onFilterTypeChange(value as LibraryFilterType)}
          classNames={{
            input:
              'border-2 border-gray-900 font-mono font-black uppercase text-xs',
          }}
        />

        {/* Sort */}
        <Select
          data={[
            {
              value: 'recently_added',
              label: 'RECENTLY ADDED',
            },
            {
              value: 'alphabetical',
              label: 'ALPHABETICAL',
            },
            {
              value: 'recently_updated',
              label: 'RECENTLY UPDATED',
            },
            {
              value: 'score',
              label: 'HIGHEST SCORE',
            },
          ]}
          value={sortBy}
          onChange={(value) => onSortChange(value as LibrarySortOption)}
          classNames={{
            input:
              'border-2 border-gray-900 font-mono font-black uppercase text-xs',
          }}
        />
      </div>
    </div>
  );
}
