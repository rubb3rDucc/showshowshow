/** Shared filter state for the Discover page. */

export type DiscoverType = 'all' | 'tv' | 'movie';
export type DiscoverSort = 'popularity' | 'rating' | 'recent' | 'title';

export interface PickedEntity {
  id: string;
  name: string;
}

export interface PickedPerson extends PickedEntity {
  department: 'cast' | 'crew';
}

export interface DiscoverFilters {
  type: DiscoverType;
  genres: string[];
  /** Inclusive [from, to] release-year range, or null when the full span is selected. */
  yearRange: [number, number] | null;
  minRating: number | null;
  sort: DiscoverSort;
  provider: PickedEntity | null;
  studios: PickedEntity[];
  people: PickedPerson[];
  // Added filters
  language: string | null;
  runtime: string | null;
  certification: string | null;
  /** TV-only: airing / ended / production. */
  tvStatus: string | null;
  /** TV-only: scripted / miniseries / reality / documentary. */
  tvType: string | null;
  networks: PickedEntity[];
  /** Limit to not-yet-released ("Coming soon") titles. */
  upcoming: boolean;
  // Quality defaults (applied to wall + grid; not counted as "active" filters).
  /** Hide adult/NSFW results (TMDB include_adult=false / Jikan sfw=true). */
  hideAdult: boolean;
  /** Drop results with no poster artwork. */
  requireArtwork: boolean;
  // Anime lane (Jikan-backed). When animeMode is on, the bar swaps to these.
  animeMode: boolean;
  animeGenres: string[];
  /** Season term (winter/spring/summer/fall) — pairs with seasonYear for Jikan /seasons/{year}/{season}. */
  season: string | null;
  seasonYear: number | null;
  animeStatus: string | null;
  animeType: string | null;
  animeStudios: PickedEntity[];
}

export const EMPTY_FILTERS: DiscoverFilters = {
  type: 'all',
  genres: [],
  yearRange: null,
  minRating: null,
  sort: 'popularity',
  provider: null,
  studios: [],
  people: [],
  language: null,
  runtime: null,
  certification: null,
  tvStatus: null,
  tvType: null,
  networks: [],
  upcoming: false,
  hideAdult: true,
  requireArtwork: true,
  animeMode: false,
  animeGenres: [],
  season: null,
  seasonYear: null,
  animeStatus: null,
  animeType: null,
  animeStudios: [],
};

export const YEAR_MIN = 1950;
export const YEAR_MAX = new Date().getFullYear() + 1; // +1 so "Coming Soon" titles fall in range

export const SORT_LABELS: Record<DiscoverSort, string> = {
  popularity: 'Popularity',
  rating: 'Rating',
  recent: 'Newest',
  title: 'A–Z',
};

export const TYPE_LABELS: Record<DiscoverType, string> = {
  all: 'All',
  tv: 'TV',
  movie: 'Movies',
};

/**
 * True when any filter is set such that the page should leave the wall and show
 * the results grid. Sort alone (without other narrowing) stays on the wall.
 */
export function isAnyFilterActive(f: DiscoverFilters): boolean {
  return (
    f.type !== 'all' ||
    f.genres.length > 0 ||
    f.yearRange !== null ||
    f.minRating !== null ||
    f.provider !== null ||
    f.studios.length > 0 ||
    f.people.length > 0 ||
    f.language !== null ||
    f.runtime !== null ||
    f.certification !== null ||
    f.tvStatus !== null ||
    f.tvType !== null ||
    f.networks.length > 0 ||
    f.upcoming ||
    f.animeMode
  );
}
