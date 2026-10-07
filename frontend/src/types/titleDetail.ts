import type { Content, SearchResult } from './api';

/**
 * Provider-neutral detail for one title. The detail page renders only this, so
 * TMDB and the anime provider can each map into it without the page knowing
 * which one it came from.
 */
export interface TitleDetail {
  content: Content;
  /** Original-language title (romaji for anime), shown under the display title when it differs */
  original_title: string | null;
  genres: string[];
  studios: string[];
  cast: TitleCredit[];
  crew: TitleCredit[];
  relations: TitleRelation[];
  streaming: StreamingLink[];
  /** Season picker for anime split across entries (Season 1..Final); empty when there's one */
  seasons: TitleSeason[];
  /** "More like this"; undefined means the page should fetch it separately */
  recommendations?: SearchResult[];
}

export interface TitleCredit {
  /** TMDB person id, or null when the person has no page here (anime credits are MAL people) */
  person_id: number | null;
  name: string;
  /** Character for cast, job for crew */
  role: string | null;
  /** Crew grouping, e.g. "Directing" */
  department?: string;
}

export interface TitleRelation {
  /** Display label: "Sequel", "Prequel", "Side story", "Based on", ... */
  label: string;
  entries: RelatedEntry[];
}

export interface RelatedEntry {
  media: 'anime' | 'manga';
  id: number;
  title: string;
  /** Romaji, when an English title replaced it */
  original_title: string | null;
  /** Set when there is no page in the app (manga), so the link goes out */
  external_url: string | null;
}

export interface TitleSeason {
  /** Each season is its own anime entry, opened by this id */
  mal_id: number;
  label: string;
  episodes: number | null;
}

export interface StreamingLink {
  name: string;
  url: string;
}

/** Which id a detail page was opened with */
export type TitleSource =
  | { kind: 'tmdb'; type: 'tv' | 'movie'; tmdbId: number }
  | { kind: 'anime'; malId: number };
