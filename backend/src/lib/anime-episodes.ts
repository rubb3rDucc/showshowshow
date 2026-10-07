import type { Insertable } from 'kysely';
import { db } from '../db/index.js';
import type { Database } from '../db/types.js';
import { getAnimeEpisodes, animeEpisodeNumber } from './jikan.js';
import { cleanSynopsis } from './anime-detail.js';

/**
 * Stores any of an anime's episodes we don't have yet. The provider has no
 * seasons (each season is its own entry), so everything lands in season 1.
 * Fetches every page, checks existing rows once, then batch-inserts the rest.
 * Shared by the episode routes and the schedule generator.
 */
export async function syncAnimeEpisodes(content: {
  id: string;
  mal_id: number;
  default_duration: number | null;
}): Promise<{ inserted: number }> {
  const all: any[] = [];
  for (let page = 1, hasMore = true; hasMore; page++) {
    const res = await getAnimeEpisodes(content.mal_id, page);
    all.push(...(res.episodes || []));
    hasMore = page < (res.pagination?.last_visible_page || 1);
  }

  const existing = await db
    .selectFrom('episodes')
    .select('episode_number')
    .where('content_id', '=', content.id)
    .where('season', '=', 1)
    .execute();
  const have = new Set(existing.map((e) => e.episode_number));

  const rows: Insertable<Database['episodes']>[] = [];
  for (const [idx, ep] of all.entries()) {
    const number = animeEpisodeNumber(ep, idx + 1);
    if (have.has(number)) continue;
    have.add(number); // also guards against the provider repeating an episode
    rows.push({
      id: crypto.randomUUID(),
      content_id: content.id,
      season: 1,
      episode_number: number,
      title: ep.title || `Episode ${number}`,
      overview: cleanSynopsis(ep.synopsis),
      duration: content.default_duration || 24,
      air_date: ep.aired ? new Date(ep.aired) : null,
      still_url: ep.images?.jpg?.image_url || null,
      created_at: new Date(),
    });
  }

  if (rows.length > 0) {
    await db.transaction().execute(async (trx) => {
      // Batches of 100 keep long runners (One Piece) under query size limits
      for (let i = 0; i < rows.length; i += 100) {
        await trx.insertInto('episodes').values(rows.slice(i, i + 100)).execute();
      }
    });
  }
  return { inserted: rows.length };
}
