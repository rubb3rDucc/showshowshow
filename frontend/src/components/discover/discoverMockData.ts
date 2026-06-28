import type { SearchResult } from '../../types/api';

/**
 * Mock data for the Discover redesign prototype (/discover-next).
 *
 * This exists purely so the page can be reviewed visually before any backend
 * `/api/discover` work is wired up. Posters use seeded picsum images so the
 * layout always renders; titles/metadata are representative, not real catalog
 * data. Delete this module once the real API client (api/discover.ts) lands.
 */

let idSeq = 1000;

function poster(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/300/450`;
}

function backdrop(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}-bd/780/440`;
}

/** Prototype result type — SearchResult plus the TMDB `adult` flag we filter on. */
export type MockResult = SearchResult & { adult?: boolean };

interface MakeOpts {
  title: string;
  type?: 'tv' | 'movie';
  year?: number;
  rating?: number;
  adult?: boolean;
  noPoster?: boolean;
}

function make({ title, type = 'tv', year = 2022, rating = 7.5, adult = false, noPoster = false }: MakeOpts): MockResult {
  const tmdbId = idSeq++;
  return {
    tmdb_id: tmdbId,
    mal_id: null,
    title,
    title_english: title,
    title_japanese: null,
    overview:
      'A representative synopsis used only for the Discover prototype preview. Replace with live TMDB data once the discover API is wired up.',
    poster_url: noPoster ? null : poster(title),
    backdrop_url: noPoster ? null : backdrop(title),
    content_type: type,
    media_type: type,
    release_date: `${year}-0${((tmdbId % 9) + 1)}-12`,
    vote_average: rating,
    popularity: 1000 - (tmdbId % 1000),
    data_source: 'tmdb',
    rating: null,
    is_cached: false,
    cached_id: null,
    cached_type: null,
    adult,
  };
}

function row(titles: string[], type: 'tv' | 'movie' = 'tv'): MockResult[] {
  return titles.map((t, i) =>
    make({ title: t, type, year: 2018 + (i % 8), rating: 6.4 + ((i * 7) % 36) / 10 })
  );
}

/** A descriptor that the wall's "See All" hands to the grid to preset filters. */
export interface WallRowFilter {
  genre?: string;
  sort?: string;
  upcoming?: boolean;
  provider?: string;
  anime?: boolean;
}

export interface WallRow {
  key: string;
  title: string;
  /** When set, "See All" deep-links the grid into discover mode with these filters. */
  filter?: WallRowFilter;
  /** Personalized rows show a small "For you" eyebrow. */
  personalized?: boolean;
  items: MockResult[];
}

export const MOCK_WALL: WallRow[] = [
  {
    key: 'trending',
    title: 'Trending Now',
    filter: { sort: 'popularity' },
    items: row([
      'Nightfall Protocol', 'The Glasshouse', 'Cinders', 'Vermilion',
      'Static Bloom', 'Halcyon Days', 'The Long Quiet', 'Paper Cities',
      'Undertow', 'Lantern', 'Foxglove', 'Mercury Rising Sun',
    ]),
  },
  {
    key: 'popular',
    title: 'Popular',
    filter: { sort: 'popularity' },
    items: row(
      ['Atlas Shrugged Off', 'Iron Meridian', 'Saltwater', 'The Ninth Gate House',
       'Cobalt', 'Driftwood', 'Northern Exposure 2', 'Velour',
       'The Understudy', 'Greenlight', 'Marrow', 'Tidepools'],
      'movie'
    ),
  },
  {
    key: 'new',
    title: 'New Releases',
    filter: { sort: 'recent' },
    items: row([
      'Echoes of Tomorrow', 'The Quiet Part', 'Riverbend', 'Sundowners',
      'Glass Antenna', 'Hollow Coast', 'The Last Ferry', 'Moonlit Mile',
      'Cassette', 'Brushfire', 'The Inheritance Lottery', 'Slow Light',
    ]),
  },
  {
    key: 'upcoming',
    title: 'Coming Soon',
    filter: { upcoming: true },
    items: row(
      ['Dune: Part Forever', 'The Bureau', 'Wintering', 'Apex',
       'Silverline', 'The Cartographer', 'Hush Country', 'Origami',
       'Nine Lives Later', 'Tin Soldiers', 'The Long Way Down', 'Aurora'],
      'movie'
    ),
  },
  {
    key: 'scifi',
    title: 'Sci-Fi & Fantasy',
    filter: { genre: 'scifi' },
    items: row([
      'Orbital', 'The Hollow Star', 'Quantum Garden', 'Redshift',
      'The Tessellation', 'Far Harbor', 'Singularity Hotel', 'Eventide',
      'The Pale Engine', 'Lightyears', 'Astral', 'The Faraday Cage',
    ]),
  },
  {
    key: 'comedy',
    title: 'Comedy',
    filter: { genre: 'comedy' },
    items: row([
      'Office Politics', 'The Roommate Agreement', 'Brunch Club', 'Hot Mess',
      'Two Left Feet', 'The Group Chat', 'Suburban Legends', 'Awkward Inc.',
      'The Wedding Planners', 'Side Quest', 'Open Mic', 'Small Talk',
    ]),
  },
  {
    key: 'because',
    title: 'Because you watched Severance',
    personalized: true,
    filter: { genre: 'scifi' },
    items: row([
      'The Department', 'Greyscale', 'Clockwork Floor', 'The Annex',
      'Cubicle', 'After Hours', 'The Quiet Promotion', 'Lumen',
      'The Severed', 'Onboarding', 'Performance Review', 'The Break Room',
    ]),
  },
  {
    key: 'anime-season',
    title: 'Anime This Season',
    filter: { anime: true },
    items: row([
      'Crimson Hour', 'Starlight Brigade', 'The Wandering Blade', 'Neon Pilgrims',
      'Petal Storm', 'Iron Lotus', 'Midnight Ramen', 'The Last Summoner',
      'Azure Depths', 'Clockwork Heart', 'Sakura Static', 'Phantom Circuit',
    ]),
  },
  {
    key: 'anime-top',
    title: 'Top Anime',
    filter: { anime: true },
    items: row([
      'Blade of the Eclipse', 'Spirit Chronicle', 'The Alchemist War', 'Hollow Crown',
      'Tidewalker', 'Dragon Recursion', 'The Silent Sword', 'Moonlit Vagrant',
      'Ashfall', 'The Ninth Realm', 'Starbound', 'Requiem Engine',
    ]),
  },
];

/** Anime grid pool (Jikan-style), shown when anime mode is on. */
export const MOCK_ANIME_POOL: SearchResult[] = [
  ...MOCK_WALL.filter((r) => r.filter?.anime).flatMap((r) => r.items),
];

export const ANIME_GENRES: { slug: string; name: string }[] = [
  { slug: 'action', name: 'Action' },
  { slug: 'shounen', name: 'Shounen' },
  { slug: 'seinen', name: 'Seinen' },
  { slug: 'isekai', name: 'Isekai' },
  { slug: 'slice-of-life', name: 'Slice of Life' },
  { slug: 'mecha', name: 'Mecha' },
  { slug: 'romance', name: 'Romance' },
  { slug: 'sports', name: 'Sports' },
];

// Season term + year are picked separately (Jikan /seasons/{year}/{season}).
export const SEASON_TERMS: Option[] = [
  { value: 'winter', label: 'Winter' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
];

// Values match Jikan's `status` enum: airing / complete / upcoming.
export const ANIME_STATUSES: Option[] = [
  { value: 'airing', label: 'Airing' },
  { value: 'complete', label: 'Finished' },
  { value: 'upcoming', label: 'Upcoming' },
];

export const ANIME_TYPES: Option[] = [
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'Movie' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'special', label: 'Special' },
];

export const MOCK_ANIME_STUDIOS: { id: string; name: string }[] = [
  { id: '569', name: 'MAPPA' },
  { id: '21', name: 'Studio Ghibli' },
  { id: '4', name: 'Bones' },
  { id: '858', name: 'Wit Studio' },
  { id: '2', name: 'Kyoto Animation' },
  { id: '43', name: 'ufotable' },
  { id: '11', name: 'Madhouse' },
];

/** A flat pool the grid pages through when any filter/search is active.
 *  Includes a few posterless + adult entries so the quality toggles are demonstrable. */
export const MOCK_GRID_POOL: MockResult[] = [
  ...MOCK_WALL.flatMap((r) => r.items),
  make({ title: 'Untitled Pilot', type: 'tv', noPoster: true }),
  make({ title: 'Lost Reel', type: 'movie', noPoster: true }),
  make({ title: 'After Dark', type: 'movie', adult: true }),
  make({ title: 'Midnight Channel', type: 'tv', adult: true }),
];

export const MOCK_GENRES: { slug: string; name: string }[] = [
  { slug: 'action', name: 'Action & Adventure' },
  { slug: 'comedy', name: 'Comedy' },
  { slug: 'drama', name: 'Drama' },
  { slug: 'scifi', name: 'Sci-Fi & Fantasy' },
  { slug: 'thriller', name: 'Thriller' },
  { slug: 'horror', name: 'Horror' },
  { slug: 'animation', name: 'Animation' },
  { slug: 'documentary', name: 'Documentary' },
];

export const MOCK_PROVIDERS: { id: string; name: string }[] = [
  { id: '8', name: 'Netflix' },
  { id: '1899', name: 'Max' },
  { id: '337', name: 'Disney+' },
  { id: '15', name: 'Hulu' },
  { id: '9', name: 'Prime Video' },
  { id: '350', name: 'Apple TV+' },
  { id: '531', name: 'Paramount+' },
  { id: '386', name: 'Peacock' },
];

/** Mock studio typeahead results (real flow hits /api/discover/companies). */
export const MOCK_STUDIOS: { id: string; name: string }[] = [
  { id: '41077', name: 'A24' },
  { id: '420', name: 'Marvel Studios' },
  { id: '2', name: 'Walt Disney Pictures' },
  { id: '10342', name: 'Studio Ghibli' },
  { id: '4', name: 'Paramount' },
  { id: '33', name: 'Universal Pictures' },
  { id: '174', name: 'Warner Bros.' },
];

/** Mock people typeahead results (real flow hits /api/discover/people). */
export const MOCK_PEOPLE: { id: string; name: string; department: 'cast' | 'crew' }[] = [
  { id: '525', name: 'Christopher Nolan', department: 'crew' },
  { id: '1190668', name: 'Timothée Chalamet', department: 'cast' },
  { id: '6193', name: 'Leonardo DiCaprio', department: 'cast' },
  { id: '488', name: 'Steven Spielberg', department: 'crew' },
  { id: '5081', name: 'Emily Blunt', department: 'cast' },
  { id: '1223', name: 'Denis Villeneuve', department: 'crew' },
];

interface Option {
  value: string;
  label: string;
}

/** Original language → TMDB with_original_language code. */
export const LANGUAGES: Option[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

/** Runtime presets → TMDB with_runtime.gte/.lte (minutes). */
export const RUNTIMES: Option[] = [
  { value: 'lt30', label: 'Under 30m' },
  { value: '30to60', label: '30–60m' },
  { value: '60to90', label: '1–1½h' },
  { value: 'gt120', label: '2h+' },
];

/** Content rating buckets → mapped to TMDB certification per type/country server-side. */
export const CERTIFICATIONS: Option[] = [
  { value: 'family', label: 'Family' },
  { value: 'teen', label: 'Teen' },
  { value: 'mature', label: 'Mature' },
];

/** TV status → TMDB with_status. */
export const TV_STATUSES: Option[] = [
  { value: 'airing', label: 'Airing' },
  { value: 'ended', label: 'Ended' },
  { value: 'production', label: 'In production' },
];

/** TV type → TMDB with_type. */
export const TV_TYPES: Option[] = [
  { value: 'scripted', label: 'Scripted' },
  { value: 'miniseries', label: 'Miniseries' },
  { value: 'reality', label: 'Reality' },
  { value: 'documentary', label: 'Documentary' },
];

/** Broadcast networks → TMDB with_networks (distinct from streaming providers). */
export const MOCK_NETWORKS: { id: string; name: string }[] = [
  { id: '49', name: 'HBO' },
  { id: '174', name: 'AMC' },
  { id: '80', name: 'Adult Swim' },
  { id: '88', name: 'FX' },
  { id: '4', name: 'BBC One' },
  { id: '67', name: 'Showtime' },
  { id: '56', name: 'Cartoon Network' },
];

export const labelOf = (opts: Option[], value: string | null): string =>
  (value ? opts.find((o) => o.value === value)?.label : undefined) ?? value ?? '';
