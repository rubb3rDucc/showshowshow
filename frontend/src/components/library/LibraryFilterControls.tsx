import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Menu } from '@mantine/core';
import { Search, X, ChevronDown } from 'lucide-react';
import type { LibraryFilterType, LibrarySortOption, LibraryStatus } from '../../types/library.types';

export type LibraryStatusFilter = LibraryStatus | 'all';

interface LibraryFilterControlsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterStatus: LibraryStatusFilter;
  onFilterStatusChange: (value: LibraryStatusFilter) => void;
  filterType: LibraryFilterType;
  onFilterTypeChange: (value: LibraryFilterType) => void;
  sortBy: LibrarySortOption;
  onSortChange: (value: LibrarySortOption) => void;
  /** Optional trailing control (e.g. poster size), separated by a divider on ≥sm. */
  trailing?: ReactNode;
}

const STATUS_LABELS: Record<LibraryStatusFilter, string> = {
  all: 'All',
  watching: 'Watching',
  plan_to_watch: 'Plan to watch',
  completed: 'Completed',
  dropped: 'Dropped',
};

const TYPE_LABELS: Record<LibraryFilterType, string> = {
  all: 'All types',
  show: 'TV Shows',
  movie: 'Movies',
};

const SORT_OPTIONS: { value: LibrarySortOption; label: string }[] = [
  { value: 'recently_added', label: 'Recently added' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'recently_updated', label: 'Recently updated' },
  { value: 'last_watched', label: 'Last watched' },
  { value: 'score', label: 'Highest score' },
  { value: 'progress', label: 'Progress' },
];

const triggerClass =
  'inline-flex items-center gap-1 whitespace-nowrap min-h-[44px] py-2 sm:min-h-0 sm:py-0 text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] transition-colors';

/**
 * Quiet, borderless filter controls for the tabs row: an expandable search icon
 * plus faint "Type ▾" / "Sort ▾" text menus. Keeps the wall the visual hero.
 */
export function LibraryFilterControls({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterType,
  onFilterTypeChange,
  sortBy,
  onSortChange,
  trailing,
}: LibraryFilterControlsProps) {
  const [open, setOpen] = useState(searchQuery.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {open ? (
        <div className="flex items-center gap-1.5 min-h-[44px] sm:min-h-0 text-[rgb(var(--color-text-secondary))]">
          <Search size={15} />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={() => {
              if (!searchQuery) setOpen(false);
            }}
            placeholder="Search"
            className="bg-transparent outline-none border-0 w-28 sm:w-40 text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-tertiary))]"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onSearchChange('');
                inputRef.current?.focus();
              }}
              className="text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Search"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
        >
          <Search size={16} />
        </button>
      )}

      <Menu shadow="sm" width={170} position="bottom-end">
        <Menu.Target>
          <button type="button" className={triggerClass}>
            {STATUS_LABELS[filterStatus]} <ChevronDown size={13} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          {(Object.keys(STATUS_LABELS) as LibraryStatusFilter[]).map((s) => (
            <Menu.Item key={s} onClick={() => onFilterStatusChange(s)} fw={filterStatus === s ? 600 : 400}>
              {STATUS_LABELS[s]}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      <Menu shadow="sm" width={160} position="bottom-end">
        <Menu.Target>
          <button type="button" className={triggerClass}>
            {TYPE_LABELS[filterType]} <ChevronDown size={13} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          {(Object.keys(TYPE_LABELS) as LibraryFilterType[]).map((t) => (
            <Menu.Item
              key={t}
              onClick={() => onFilterTypeChange(t)}
              fw={filterType === t ? 600 : 400}
            >
              {TYPE_LABELS[t]}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      <Menu shadow="sm" width={180} position="bottom-end">
        <Menu.Target>
          <button type="button" className={triggerClass}>
            {sortLabel} <ChevronDown size={13} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          {SORT_OPTIONS.map((o) => (
            <Menu.Item
              key={o.value}
              onClick={() => onSortChange(o.value)}
              fw={sortBy === o.value ? 600 : 400}
            >
              {o.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      {trailing && (
        <>
          <span className="hidden sm:inline-block w-px h-4 bg-[rgb(var(--color-border-default))]" aria-hidden />
          {trailing}
        </>
      )}
    </div>
  );
}
