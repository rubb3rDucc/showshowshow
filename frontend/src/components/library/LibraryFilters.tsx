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
      <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm dark:shadow-gray-950/50">
        <TextInput
          placeholder="Search library..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftSection={<Search size={16} className="text-[rgb(var(--color-text-secondary))]" />}
          size="md"
          classNames={{
            input:
              'border-0 font-normal text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-tertiary))] placeholder:font-normal',
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
              label: 'All Status',
            },
            {
              value: 'watching',
              label: 'Watching',
            },
            {
              value: 'completed',
              label: 'Completed',
            },
            {
              value: 'dropped',
              label: 'Dropped',
            },
            {
              value: 'plan_to_watch',
              label: 'Plan to Watch',
            },
          ]}
          value={filterStatus}
          onChange={(value) =>
            onFilterStatusChange(value as LibraryFilterStatus)
          }
          classNames={{
            input:
              'border border-[rgb(var(--color-border-default))] rounded-lg font-semibold text-sm shadow-sm dark:shadow-gray-950/50',
          }}
        />

        {/* Type Filter */}
        <Select
          data={[
            {
              value: 'all',
              label: 'All Types',
            },
            {
              value: 'show',
              label: 'TV Shows',
            },
            {
              value: 'movie',
              label: 'Movies',
            },
          ]}
          value={filterType}
          onChange={(value) => onFilterTypeChange(value as LibraryFilterType)}
          classNames={{
            input:
              'border border-[rgb(var(--color-border-default))] rounded-lg font-semibold text-sm shadow-sm dark:shadow-gray-950/50',
          }}
        />

        {/* Sort */}
        <Select
          data={[
            {
              value: 'recently_added',
              label: 'Recently Added',
            },
            {
              value: 'alphabetical',
              label: 'Alphabetical',
            },
            {
              value: 'recently_updated',
              label: 'Recently Updated',
            },
            {
              value: 'score',
              label: 'Highest Score',
            },
          ]}
          value={sortBy}
          onChange={(value) => onSortChange(value as LibrarySortOption)}
          classNames={{
            input:
              'border border-[rgb(var(--color-border-default))] rounded-lg font-semibold text-sm shadow-sm dark:shadow-gray-950/50',
          }}
        />
      </div>
    </div>
  );
}
