import { useMemo, useState } from 'react';
import { Pagination } from '@mantine/core';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { DiscoverFilterBar } from '../components/discover/DiscoverFilterBar';
import { DiscoverPosterCard } from '../components/discover/DiscoverPosterCard';
import { DiscoverRow } from '../components/discover/DiscoverRow';
import {
  type DiscoverFilters,
  EMPTY_FILTERS,
  SORT_LABELS,
  TYPE_LABELS,
  isAnyFilterActive,
} from '../components/discover/discoverTypes';
import {
  MOCK_WALL,
  MOCK_GRID_POOL,
  MOCK_ANIME_POOL,
  MOCK_GENRES,
  ANIME_GENRES,
  SEASON_TERMS,
  ANIME_STATUSES,
  ANIME_TYPES,
  LANGUAGES,
  RUNTIMES,
  CERTIFICATIONS,
  TV_STATUSES,
  TV_TYPES,
  labelOf,
  type WallRow,
  type MockResult,
} from '../components/discover/discoverMockData';
import type { SearchResult } from '../types/api';

const PAGE_SIZE = 18;

const genreName = (slug: string) =>
  [...MOCK_GENRES, ...ANIME_GENRES].find((g) => g.slug === slug)?.name ?? slug;

/**
 * Discover redesign prototype (/discover-next).
 *
 * Renders entirely on mock data so the layout and interaction model can be
 * reviewed before the real /api/discover endpoints exist. Three states:
 *  - Wall: Spotify/Apple-Music-style carousel rows (no query, no filters)
 *  - Grid: filtered results with pagination (any filter active)
 *  - Search: same grid, driven by the text query
 */
export function DiscoverNext() {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const patch = (p: Partial<DiscoverFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(1);
  };

  const searchActive = q.trim().length > 0;
  const gridMode = searchActive || isAnyFilterActive(filters);

  const openItem = (item: SearchResult) =>
    toast(item.title, { description: 'Detail view is wired up in the real build.' });

  const seeAll = (rowFilters: WallRow['filter']) => {
    if (rowFilters?.anime) patch({ animeMode: true });
    else if (rowFilters?.genre) patch({ genres: [rowFilters.genre], sort: 'popularity' });
    else if (rowFilters?.upcoming) patch({ sort: 'recent', type: 'movie' });
    else patch({ sort: (rowFilters?.sort as DiscoverFilters['sort']) ?? 'popularity', type: filters.type });
  };

  // Quality defaults applied to wall + grid: drop adult / artwork-less entries.
  const passesQuality = (it: MockResult) =>
    (!filters.requireArtwork || !!it.poster_url) && (!filters.hideAdult || !it.adult);

  // Mock "results": page through the shared pool. Real build hits the API.
  const pooled = useMemo(() => {
    const base = filters.animeMode
      ? MOCK_ANIME_POOL
      : filters.type === 'all'
        ? MOCK_GRID_POOL
        : MOCK_GRID_POOL.filter((r) => r.content_type === filters.type);
    return base.filter(passesQuality);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.animeMode, filters.type, filters.requireArtwork, filters.hideAdult]);

  const totalPages = Math.max(1, Math.ceil(pooled.length / PAGE_SIZE));
  const pageItems = pooled.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeChips = buildChips(filters, patch);
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQ('');
    setPage(1);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Prototype · mock data"
        title="Discover"
        className="!mb-4"
      />

      {/* Filter toolbar */}
      <div className="flex items-center mb-5 pb-3 border-b border-[rgb(var(--color-border-subtle))]">
        <DiscoverFilterBar q={q} onQChange={setQ} filters={filters} onPatch={patch} />
      </div>

      {gridMode ? (
        <>
          {/* Active filter chips */}
          {(activeChips.length > 0 || searchActive) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {searchActive && (
                <Chip label={`"${q.trim()}"`} onRemove={() => setQ('')} />
              )}
              {activeChips.map((c) => (
                <Chip key={c.key} label={c.label} onRemove={c.onRemove} />
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center min-h-[36px] px-1 text-xs text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] underline underline-offset-2"
              >
                Clear all
              </button>
            </div>
          )}

          <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">
            {searchActive
              ? `Results for "${q.trim()}"`
              : `${pooled.length} titles${filters.provider ? ` on ${filters.provider.name}` : ''}`}
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
            {pageItems.map((item) => (
              <DiscoverPosterCard key={item.tmdb_id} item={item} onOpen={() => openItem(item)} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center mt-10">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </div>
          )}
        </>
      ) : (
        <div className="space-y-10">
          {/* Carousel wall */}
          {MOCK_WALL.map((wallRow) => (
            <DiscoverRow
              key={wallRow.key}
              title={wallRow.title}
              personalized={wallRow.personalized}
              items={wallRow.items.filter(passesQuality)}
              onSeeAll={() => seeAll(wallRow.filter)}
              onItemClick={openItem}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

function buildChips(filters: DiscoverFilters, patch: (p: Partial<DiscoverFilters>) => void): ActiveChip[] {
  const chips: ActiveChip[] = [];

  // Shared between lanes.
  const pushYearRating = () => {
    if (filters.yearRange) {
      chips.push({
        key: 'years',
        label: `${filters.yearRange[0]}–${filters.yearRange[1]}`,
        onRemove: () => patch({ yearRange: null }),
      });
    }
    if (filters.minRating) {
      chips.push({ key: 'rating', label: `★ ${filters.minRating}+`, onRemove: () => patch({ minRating: null }) });
    }
  };
  const pushSort = () => {
    if (filters.sort !== 'popularity') {
      chips.push({ key: 'sort', label: `Sort: ${SORT_LABELS[filters.sort]}`, onRemove: () => patch({ sort: 'popularity' }) });
    }
  };

  // Anime lane has its own chip set.
  if (filters.animeMode) {
    chips.push({ key: 'anime', label: 'Anime', onRemove: () => patch({ animeMode: false }) });
    filters.animeGenres.forEach((g) =>
      chips.push({ key: `ag-${g}`, label: genreName(g), onRemove: () => patch({ animeGenres: filters.animeGenres.filter((x) => x !== g) }) })
    );
    pushYearRating();
    if (filters.season && filters.seasonYear) {
      chips.push({
        key: 'season',
        label: `${labelOf(SEASON_TERMS, filters.season)} ${filters.seasonYear}`,
        onRemove: () => patch({ season: null, seasonYear: null }),
      });
    }
    if (filters.animeStatus) {
      chips.push({ key: 'astatus', label: labelOf(ANIME_STATUSES, filters.animeStatus), onRemove: () => patch({ animeStatus: null }) });
    }
    if (filters.animeType) {
      chips.push({ key: 'atype', label: labelOf(ANIME_TYPES, filters.animeType), onRemove: () => patch({ animeType: null }) });
    }
    filters.animeStudios.forEach((s) =>
      chips.push({ key: `as-${s.id}`, label: s.name, onRemove: () => patch({ animeStudios: filters.animeStudios.filter((x) => x.id !== s.id) }) })
    );
    pushSort();
    return chips;
  }

  if (filters.type !== 'all') {
    chips.push({ key: 'type', label: TYPE_LABELS[filters.type], onRemove: () => patch({ type: 'all' }) });
  }
  filters.genres.forEach((g) =>
    chips.push({ key: `g-${g}`, label: genreName(g), onRemove: () => patch({ genres: filters.genres.filter((x) => x !== g) }) })
  );
  pushYearRating();
  if (filters.provider) {
    chips.push({ key: 'provider', label: filters.provider.name, onRemove: () => patch({ provider: null }) });
  }
  filters.studios.forEach((s) =>
    chips.push({ key: `s-${s.id}`, label: s.name, onRemove: () => patch({ studios: filters.studios.filter((x) => x.id !== s.id) }) })
  );
  filters.people.forEach((p) =>
    chips.push({
      key: `p-${p.id}`,
      label: `${p.name} · ${p.department}`,
      onRemove: () => patch({ people: filters.people.filter((x) => x.id !== p.id) }),
    })
  );
  if (filters.language) {
    chips.push({ key: 'lang', label: labelOf(LANGUAGES, filters.language), onRemove: () => patch({ language: null }) });
  }
  if (filters.runtime) {
    chips.push({ key: 'runtime', label: labelOf(RUNTIMES, filters.runtime), onRemove: () => patch({ runtime: null }) });
  }
  if (filters.certification) {
    chips.push({ key: 'cert', label: labelOf(CERTIFICATIONS, filters.certification), onRemove: () => patch({ certification: null }) });
  }
  if (filters.tvStatus) {
    chips.push({ key: 'tvstatus', label: labelOf(TV_STATUSES, filters.tvStatus), onRemove: () => patch({ tvStatus: null }) });
  }
  if (filters.tvType) {
    chips.push({ key: 'tvtype', label: labelOf(TV_TYPES, filters.tvType), onRemove: () => patch({ tvType: null }) });
  }
  filters.networks.forEach((n) =>
    chips.push({ key: `n-${n.id}`, label: n.name, onRemove: () => patch({ networks: filters.networks.filter((x) => x.id !== n.id) }) })
  );
  if (filters.upcoming) {
    chips.push({ key: 'upcoming', label: 'Coming soon', onRemove: () => patch({ upcoming: false }) });
  }
  pushSort();

  return chips;
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 pl-3 pr-1 min-h-[36px] rounded-full bg-[rgb(var(--color-bg-elevated))] text-sm text-[rgb(var(--color-text-primary))]">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))]"
      >
        <X size={15} />
      </button>
    </span>
  );
}
