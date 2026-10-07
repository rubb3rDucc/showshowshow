import { db } from '../db/index.js';
import { normalizeRating } from './rating-utils.js';

interface ResultLike {
  tmdb_id?: number | null;
  mal_id?: number | null;
  rating?: string | null;
  [key: string]: any;
}

/**
 * Annotate search/discover results with cache status from the `content` table
 * using a single batch query (avoids N+1). Mirrors the logic that lived inline
 * in the content search route so search + discover share one implementation.
 *
 * Adds: is_cached, cached_id, cached_type, and a normalized rating (preferring
 * the cached rating when present).
 */
export async function attachCacheStatus<T extends ResultLike>(
  results: T[]
): Promise<Array<T & { is_cached: boolean; cached_id: string | null; cached_type: string | null }>> {
  const tmdbIds = results.filter((r) => r.tmdb_id).map((r) => r.tmdb_id as number);
  const malIds = results.filter((r) => r.mal_id).map((r) => r.mal_id as number);

  let cachedContent: Array<{
    id: string;
    tmdb_id: number | null;
    mal_id: number | null;
    content_type: string;
    rating: string | null;
  }> = [];

  if (tmdbIds.length > 0 || malIds.length > 0) {
    cachedContent = await db
      .selectFrom('content')
      .select(['id', 'tmdb_id', 'mal_id', 'content_type', 'rating'])
      .where((eb) => {
        const conditions = [];
        if (tmdbIds.length > 0) conditions.push(eb('tmdb_id', 'in', tmdbIds));
        if (malIds.length > 0) conditions.push(eb('mal_id', 'in', malIds));
        return eb.or(conditions);
      })
      .execute();
  }

  const byTmdbId = new Map(cachedContent.filter((c) => c.tmdb_id).map((c) => [c.tmdb_id, c]));
  const byMalId = new Map(cachedContent.filter((c) => c.mal_id).map((c) => [c.mal_id, c]));

  return results.map((result) => {
    const cached = byTmdbId.get(result.tmdb_id ?? -1) || byMalId.get(result.mal_id ?? -1) || null;
    return {
      ...result,
      rating: normalizeRating(cached?.rating || result.rating || null),
      is_cached: !!cached,
      cached_id: cached?.id || null,
      cached_type: cached?.content_type || null,
    };
  });
}
