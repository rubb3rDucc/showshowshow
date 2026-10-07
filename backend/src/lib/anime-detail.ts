/**
 * Maps anime provider responses (Jikan v4 shape) into the provider-neutral
 * title detail the detail page renders. Pure: callers fetch, this only maps.
 */

export interface TitleCredit {
  person_id: number | null; // TMDB person id; anime credits are MAL people, so always null here
  name: string;
  role: string | null;
  department?: string;
}

export interface RelatedEntry {
  media: 'anime' | 'manga';
  id: number;
  title: string;
  /** Romaji, when an English title replaced it */
  original_title: string | null;
  external_url: string | null;
}

/** English/romaji titles for related entries, keyed by titleKey(). Built by the caller, one lookup per entry. */
export type TitleLookup = Map<string, { title: string | null; title_english: string | null }>;

export const titleKey = (media: 'anime' | 'manga', id: number) => `${media}:${id}`;

export interface TitleRelation {
  label: string;
  entries: RelatedEntry[];
}

export interface StreamingLink {
  name: string;
  url: string;
}

const MAX_CAST = 40;
const MAX_STREAMING = 4;
const MAX_RECOMMENDATIONS = 12;

// Provider relation -> display label, in display order. Unlisted relations
// ("Character", "Other": cameos and music videos) are dropped as noise.
const RELATION_LABELS: Array<[string, string]> = [
  ['Prequel', 'Prequel'],
  ['Sequel', 'Sequel'],
  ['Parent Story', 'Parent story'],
  ['Side Story', 'Side story'],
  ['Spin-Off', 'Spin-off'],
  ['Alternative Version', 'Alternative version'],
  ['Alternative Setting', 'Alternative setting'],
  ['Summary', 'Summary'],
  ['Full Story', 'Full story'],
  ['Adaptation', 'Based on'],
];

// Staff positions worth showing, and the crew group each lands in. Exact
// matches only: per-episode credits ("Storyboard (eps 1, 11)") are skipped.
const KEY_STAFF: Record<string, string> = {
  Director: 'Directing',
  'Original Creator': 'Writing',
  'Series Composition': 'Writing',
  'Character Design': 'Art',
  'Original Character Design': 'Art',
  'Chief Animation Director': 'Art',
  Music: 'Sound',
  'Sound Director': 'Sound',
};

// MAL tags that aren't really genres
const HIDDEN_GENRES = new Set(['Award Winning']);

/** English title first; the provider's default title is romaji */
export function animeDisplayTitle(anime: any): string {
  return anime.title_english || anime.title || anime.title_japanese || 'Unknown';
}

/** The romaji/original title, only when it differs from the display title */
export function animeOriginalTitle(anime: any): string | null {
  const original = anime.title || null;
  return original && original !== animeDisplayTitle(anime) ? original : null;
}

/**
 * A landscape image for the hero. The provider has no banner, but the trailer's
 * 16:9 YouTube thumbnail usually works. Null when there's no trailer, so the page
 * can fall back instead of stretching the portrait poster.
 */
export function animeBackdropUrl(anime: any): string | null {
  return anime.trailer?.images?.maximum_image_url || null;
}

/** Drops MAL's "[Written by MAL Rewrite]" credit line from a synopsis */
export function cleanSynopsis(synopsis: string | null | undefined): string | null {
  const cleaned = synopsis?.replace(/\s*\[Written by MAL Rewrite\]\s*$/i, '').trim();
  return cleaned || null;
}

/** MAL writes names "Last, First" */
export function flipName(name: string): string {
  const [last, first] = name.split(', ');
  return first ? `${first} ${last}` : name;
}

export function mapAnimeCast(characters: any[]): TitleCredit[] {
  // The provider lists characters alphabetically; lead with mains, most-favorited first
  return [...characters]
    .sort(
      (a, b) =>
        Number(b.role === 'Main') - Number(a.role === 'Main') || (b.favorites ?? 0) - (a.favorites ?? 0)
    )
    .slice(0, MAX_CAST)
    .map((c) => {
      const character = flipName(c.character?.name ?? '');
      const va = (c.voice_actors ?? []).find((v: any) => v.language === 'Japanese')?.person;
      return va
        ? { person_id: null, name: flipName(va.name), role: character || null }
        : { person_id: null, name: character, role: null };
    })
    .filter((c) => c.name);
}

export function mapAnimeCrew(staff: any[]): TitleCredit[] {
  const seen = new Set<string>();
  const crew: TitleCredit[] = [];
  for (const member of staff) {
    for (const position of member.positions ?? []) {
      const department = KEY_STAFF[position];
      const key = `${member.person?.mal_id}:${position}`;
      if (!department || seen.has(key)) continue;
      seen.add(key);
      crew.push({ person_id: null, name: flipName(member.person.name), role: position, department });
    }
  }
  // Provider order is arbitrary; follow KEY_STAFF so the director leads
  const order = Object.keys(KEY_STAFF);
  return crew.sort((a, b) => order.indexOf(a.role!) - order.indexOf(b.role!));
}

export function mapAnimeRelations(anime: any): TitleRelation[] {
  const relations: any[] = anime.relations ?? [];
  return RELATION_LABELS.flatMap(([relation, label]) => {
    const entries = relations
      .filter((r) => r.relation === relation)
      .flatMap((r) => r.entry ?? [])
      .filter((e: any) => e.type === 'anime' || e.type === 'manga')
      .map(
        (e: any): RelatedEntry => ({
          media: e.type,
          id: e.mal_id,
          title: e.name,
          original_title: null,
          // Anime open in the app; manga has no page here, so link out
          external_url: e.type === 'manga' ? e.url ?? null : null,
        })
      );
    return entries.length ? [{ label, entries }] : [];
  });
}

export function mapAnimeRecommendations(recommendations: any[]) {
  return [...recommendations]
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .filter((r) => r.entry?.images?.jpg?.large_image_url)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((r) => ({
      tmdb_id: null,
      mal_id: r.entry.mal_id,
      // The provider's recommendations carry the romaji title only; see applyEnglishTitles
      title: r.entry.title as string,
      title_english: null as string | null,
      title_japanese: null,
      overview: null,
      poster_url: r.entry.images.jpg.large_image_url,
      backdrop_url: null,
      content_type: 'tv' as const,
      media_type: 'tv' as const,
      release_date: null,
      vote_average: 0,
      popularity: 0,
      data_source: 'jikan' as const,
    }));
}

/**
 * Relations and recommendations arrive with romaji names only. Swap in English
 * titles from the lookup, keeping the romaji as the original. Entries missing
 * from the lookup stay as they are.
 */
export function applyEnglishTitles<R extends { mal_id: number; title: string; title_english: string | null }>(
  relations: TitleRelation[],
  recommendations: R[],
  lookup: TitleLookup
): { relations: TitleRelation[]; recommendations: R[] } {
  const english = (media: 'anime' | 'manga', id: number) => lookup.get(titleKey(media, id))?.title_english || null;

  return {
    relations: relations.map((group) => ({
      ...group,
      entries: group.entries.map((e) => {
        const en = english(e.media, e.id);
        return en && en !== e.title ? { ...e, title: en, original_title: e.title } : e;
      }),
    })),
    recommendations: recommendations.map((r) => {
      const en = english('anime', r.mal_id);
      return en ? { ...r, title: en, title_english: en } : r;
    }),
  };
}

export interface TitleSeason {
  mal_id: number;
  label: string;
  episodes: number | null;
}

const MAX_CHAIN_HOPS = 30;
// Entry types that count as a season; movies and specials in the chain stay under Related
const SEASON_TYPES = new Set(['TV', 'ONA']);

/**
 * MAL stores each season as its own entry, linked by Prequel/Sequel. Walk both
 * ways from `start` and return the whole chain in order, movies and specials
 * included where they're the only link (a movie can sit between two TV
 * seasons). When an entry has several sequels (Demon Slayer S1 has both the
 * Mugen Train movie and its TV arc), the TV/ONA one wins so no season is
 * skipped. `getAnime` returns a full record.
 */
export async function walkSeasonChain(start: any, getAnime: (malId: number) => Promise<any>): Promise<any[]> {
  const seen = new Set<number>([start.mal_id]);
  const next = async (anime: any, relation: 'Prequel' | 'Sequel'): Promise<any | null> => {
    const ids: number[] = (anime.relations ?? [])
      .filter((r: any) => r.relation === relation)
      .flatMap((r: any) => r.entry ?? [])
      .filter((e: any) => e.type === 'anime' && !seen.has(e.mal_id))
      .map((e: any) => e.mal_id);
    if (ids.length === 0) return null;
    if (ids.length === 1) return getAnime(ids[0]);
    const candidates = await Promise.all(ids.map(getAnime));
    return candidates.find((a) => SEASON_TYPES.has(a.type)) ?? candidates[0];
  };

  const before: any[] = [];
  const after: any[] = [];
  for (const [relation, out] of [['Prequel', before], ['Sequel', after]] as const) {
    let current = start;
    for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
      const found = await next(current, relation);
      if (!found) break;
      seen.add(found.mal_id);
      out.push(found);
      current = found;
    }
  }
  return [...before.reverse(), start, ...after];
}

/**
 * The season picker for a chain: TV/ONA entries only, labelled by what their
 * English title adds to the first season's ("Season 2", "Final Season").
 * Empty when there's only one season, so the page can skip the picker.
 */
export function chainToSeasons(chain: any[]): TitleSeason[] {
  const seasons = chain.filter((a) => SEASON_TYPES.has(a.type));
  if (seasons.length < 2) return [];

  const base = animeDisplayTitle(seasons[0]);
  return seasons.map((a, i) => {
    const title = animeDisplayTitle(a);
    const rest = title.startsWith(base) ? title.slice(base.length).replace(/^[\s:–-]+/, '') : title;
    return {
      mal_id: a.mal_id,
      label: i === 0 ? 'Season 1' : rest || `Season ${i + 1}`,
      episodes: a.episodes ?? null,
    };
  });
}

/** Everything the detail page needs beyond the cached content row */
export function animeToTitleDetail(
  anime: any,
  extras: { characters?: any[]; staff?: any[]; recommendations?: any[] } = {}
) {
  return {
    original_title: animeOriginalTitle(anime),
    genres: (anime.genres ?? []).map((g: any) => g.name).filter((g: string) => !HIDDEN_GENRES.has(g)),
    studios: (anime.studios ?? []).map((s: any) => s.name),
    cast: mapAnimeCast(extras.characters ?? []),
    crew: mapAnimeCrew(extras.staff ?? []),
    relations: mapAnimeRelations(anime),
    streaming: (anime.streaming ?? []).slice(0, MAX_STREAMING) as StreamingLink[],
    recommendations: mapAnimeRecommendations(extras.recommendations ?? []),
  };
}
