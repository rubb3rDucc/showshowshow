/**
 * Anime detail page data: fetches from the anime provider, maps through
 * anime-detail.ts, and caches the results in `api_cache` so the provider
 * (rate-limited per IP) is hit once per title rather than on every view.
 * When the provider is down, stale cache or the bare content row is served.
 */

import { db } from '../db/index.js';
import { ExternalServiceUnavailableError } from './errors.js';
import {
  getAnimeDetails,
  getAnimeCharacters,
  getAnimeStaff,
  getAnimeRecommendations,
  getMalEntry,
  jikanToContentFormat,
} from './jikan.js';
import {
  animeToTitleDetail,
  applyEnglishTitles,
  chainToSeasons,
  mapAnimeRecommendations,
  mapAnimeRelations,
  titleKey,
  walkSeasonChain,
  type TitleLookup,
  type TitleSeason,
} from './anime-detail.js';
import { attachCacheStatus } from './content-cache.js';
import { cached, dontCache, getCachedMany, setCachedMany, DAY } from './api-cache.js';

const DETAIL_TTL = 7 * DAY;
const SEASONS_TTL = 7 * DAY; // new seasons get announced
const RECOMMENDATIONS_TTL = 30 * DAY;
const TITLE_TTL = 90 * DAY;
// Title lookups are one provider call each; cap them so one page can't queue dozens
const MAX_TITLE_FETCHES = 15;

const detailKey = (malId: number) => `anime:detail:${malId}`;
const seasonsKey = (malId: number) => `anime:seasons:${malId}`;
const relatedKey = (malId: number) => `anime:related:${malId}`;
const malTitleKey = (media: 'anime' | 'manga', malId: number) => `mal-title:${titleKey(media, malId)}`;

type MalTitle = { title: string | null; title_english: string | null };

const isProviderDown = (err: unknown) => err instanceof ExternalServiceUnavailableError;

type ContentRow = NonNullable<Awaited<ReturnType<typeof findAnimeContent>>>;

function findAnimeContent(malId: number) {
  return db.selectFrom('content').selectAll().where('mal_id', '=', malId).executeTakeFirst();
}

/** Keeps an image only if it loads; YouTube 404s maxresdefault for some uploads */
export async function verifyImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

/** The content row for a MAL id, saved from the provider the first time it's seen */
export async function getOrCacheAnimeContent(malId: number, full?: any): Promise<ContentRow> {
  const existing = await findAnimeContent(malId);
  if (existing) return existing;

  const c = jikanToContentFormat(full ?? (await getAnimeDetails(malId)));
  return db
    .insertInto('content')
    .values({
      id: crypto.randomUUID(),
      tmdb_id: null,
      mal_id: c.mal_id,
      data_source: 'jikan',
      content_type: c.content_type,
      title: c.title,
      title_english: c.title_english,
      title_japanese: c.title_japanese,
      original_title: c.original_title,
      overview: c.overview,
      poster_url: c.poster_url,
      backdrop_url: await verifyImage(c.backdrop_url),
      release_date: c.release_date,
      first_air_date: c.first_air_date,
      default_duration: c.default_duration,
      number_of_episodes: c.number_of_episodes,
      number_of_seasons: c.number_of_seasons,
      status: c.status,
      rating: c.rating,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Brings a cached row up to date with a fresh provider record: English title,
 * cleaned synopsis, episode count and status, and a backdrop if it has none
 * (rows from before the detail page had the poster there, cleared by migration 024).
 */
async function refreshAnimeContent(content: ContentRow, full: any): Promise<ContentRow> {
  const c = jikanToContentFormat(full);
  const updates = {
    title: c.title,
    title_english: c.title_english,
    original_title: c.original_title,
    overview: c.overview,
    number_of_episodes: c.number_of_episodes,
    status: c.status,
    ...(content.backdrop_url ? {} : { backdrop_url: await verifyImage(c.backdrop_url) }),
  };
  const changed = Object.entries(updates).some(([k, v]) => (content as any)[k] !== v);
  if (!changed) return content;

  return db
    .updateTable('content')
    .set({ ...updates, updated_at: new Date() })
    .where('id', '=', content.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * English titles for anime/manga ids: from the cache, then cached content rows,
 * then the provider (capped, results saved). Ids it can't resolve are left out,
 * and callers keep the romaji for those.
 */
export async function lookupTitles(keys: Array<['anime' | 'manga', number]>): Promise<TitleLookup> {
  const wanted = [...new Map(keys.map(([media, id]) => [titleKey(media, id), [media, id] as const])).values()];
  const lookup: TitleLookup = new Map();
  if (wanted.length === 0) return lookup;

  const saved = await getCachedMany<MalTitle>(wanted.map(([media, id]) => malTitleKey(media, id)), TITLE_TTL);
  for (const [media, id] of wanted) {
    const hit = saved.get(malTitleKey(media, id));
    if (hit) lookup.set(titleKey(media, id), hit);
  }

  const missingAnime = wanted.filter(([media, id]) => media === 'anime' && !lookup.has(titleKey(media, id)));
  if (missingAnime.length > 0) {
    const rows = await db
      .selectFrom('content')
      .select(['mal_id', 'title', 'title_english', 'original_title'])
      .where('mal_id', 'in', missingAnime.map(([, id]) => id))
      .execute();
    for (const row of rows) {
      lookup.set(titleKey('anime', row.mal_id!), { title: row.original_title ?? row.title, title_english: row.title_english });
    }
  }

  // Issued together; the provider guard spaces them out to its rate limit
  const toFetch = wanted.filter(([media, id]) => !lookup.has(titleKey(media, id))).slice(0, MAX_TITLE_FETCHES);
  const fetched = await Promise.all(
    toFetch.map(async ([media, id]) => {
      try {
        const entry = await getMalEntry(media, id);
        const value: MalTitle = { title: entry?.title ?? null, title_english: entry?.title_english ?? null };
        lookup.set(titleKey(media, id), value);
        return [malTitleKey(media, id), value] as [string, MalTitle];
      } catch {
        return null; // provider down or entry removed; keep the romaji
      }
    })
  );
  await setCachedMany(fetched.filter((f) => f !== null));
  return lookup;
}

function emptyDetail(content: ContentRow) {
  return {
    original_title: content.original_title,
    genres: [],
    studios: [],
    cast: [],
    crew: [],
    relations: [],
    streaming: [],
  };
}

/**
 * The detail page for an anime: the content row plus cast, crew, relations
 * (English titles), genres, studios and streaming links. Seasons and "More like
 * this" have their own calls since they take more provider requests.
 */
export async function getAnimeTitleDetail(malId: number) {
  const existing = await findAnimeContent(malId);

  let detail;
  try {
    detail = await cached(detailKey(malId), DETAIL_TTL, async () => {
      const full = await getAnimeDetails(malId);
      await refreshAnimeContent(await getOrCacheAnimeContent(malId, full), full);

      // A failed extra shows as empty this time but isn't cached, so the next view retries
      let complete = true;
      const extra = async (fetch: () => Promise<any[]>) => {
        try {
          return await fetch();
        } catch {
          complete = false;
          return [];
        }
      };
      // Issued together; the provider guard spaces them out to its rate limit
      const relationKeys = mapAnimeRelations(full).flatMap((g) =>
        g.entries.map((e) => [e.media, e.id] as ['anime' | 'manga', number])
      );
      const [characters, staff, lookup] = await Promise.all([
        extra(() => getAnimeCharacters(malId)),
        extra(() => getAnimeStaff(malId)),
        lookupTitles(relationKeys),
      ]);

      const mapped = animeToTitleDetail(full, { characters, staff });
      const built = {
        original_title: mapped.original_title,
        genres: mapped.genres,
        studios: mapped.studios,
        cast: mapped.cast,
        crew: mapped.crew,
        relations: applyEnglishTitles(mapped.relations, [], lookup).relations,
        streaming: mapped.streaming,
      };
      return complete ? built : dontCache(built);
    });
  } catch (err) {
    // Provider down with nothing cached: still show what we know about the title
    if (isProviderDown(err) && existing) return { content: existing, ...emptyDetail(existing) };
    throw err;
  }

  // Re-read: building the detail may have created or refreshed the row
  const content = (await findAnimeContent(malId)) ?? (await getOrCacheAnimeContent(malId));
  return { content, ...detail };
}

/**
 * The season picker: every TV/ONA entry in this title's Prequel/Sequel chain.
 * Saved under every entry in the chain at once, so the other seasons of the
 * same show load instantly.
 */
export async function getAnimeSeasons(malId: number): Promise<TitleSeason[]> {
  try {
    return await cached(seasonsKey(malId), SEASONS_TTL, async () => {
      const fulls = new Map<number, any>();
      const getFull = async (id: number) => {
        if (!fulls.has(id)) fulls.set(id, await getAnimeDetails(id));
        return fulls.get(id);
      };

      const chain = await walkSeasonChain(await getFull(malId), getFull);
      const seasons = chainToSeasons(chain);
      await setCachedMany([
        ...chain.map((a): [string, unknown] => [seasonsKey(a.mal_id), seasons]),
        // The walk already has every entry's titles; save them for relation lookups
        ...chain.map((a): [string, unknown] => [
          malTitleKey('anime', a.mal_id),
          { title: a.title ?? null, title_english: a.title_english ?? null },
        ]),
      ]);
      return seasons;
    });
  } catch (err) {
    // Half a chain would mislabel seasons; show no picker this time and retry next view
    if (isProviderDown(err)) return [];
    throw err;
  }
}

/** "More like this" for an anime: the provider's user recommendations, in English */
export async function getAnimeRelated(malId: number) {
  let recommendations: ReturnType<typeof mapAnimeRecommendations>;
  try {
    recommendations = await cached(relatedKey(malId), RECOMMENDATIONS_TTL, async () => {
      const mapped = mapAnimeRecommendations(await getAnimeRecommendations(malId));
      const lookup = await lookupTitles(mapped.map((r) => ['anime', r.mal_id] as ['anime', number]));
      return applyEnglishTitles([], mapped, lookup).recommendations;
    });
  } catch (err) {
    if (isProviderDown(err)) return [];
    throw err;
  }

  // Cache status changes as people add titles, so it's attached per request
  return attachCacheStatus(recommendations);
}
