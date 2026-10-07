/**
 * Read-through cache for results built from third-party APIs, stored in the
 * `api_cache` table so copies are shared and survive deploys.
 *
 *   const detail = await cached('anime:detail:52991', 7 * DAY, () => buildDetail(52991));
 *
 * - Fresh copy (younger than maxAge): returned without calling `fetch`.
 * - Expired copy: returned straight away while `fetch` refreshes it in the
 *   background (stale-while-revalidate). If the provider is down, the old copy
 *   simply stays.
 * - No copy: `fetch` runs, its result is saved and returned; errors propagate.
 * - Concurrent callers for the same key share one `fetch`.
 * - `fetch` can return dontCache(value) for a partial result: it's returned but
 *   not saved, so the next call tries again.
 *
 * TMDB data must use a maxAge under TMDB's 6-month caching limit.
 */

import { sql } from 'kysely';
import { db } from '../db/index.js';
import { ExternalServiceUnavailableError } from './errors.js';

export const DAY = 24 * 60 * 60 * 1000;

class DontCache<T> {
  constructor(readonly value: T) {}
}

/** Wraps a result that should be returned but not saved (e.g. some parts failed to load) */
export const dontCache = <T>(value: T) => new DontCache(value);

const inFlight = new Map<string, Promise<unknown>>();

const isFresh = (fetchedAt: Date, maxAge: number) => Date.now() - new Date(fetchedAt).getTime() < maxAge;
// node-postgres sends JS arrays as Postgres arrays, so jsonb goes in as text
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`;

export async function cached<T>(key: string, maxAge: number, fetch: () => Promise<T | DontCache<T>>): Promise<T> {
  const row = await db.selectFrom('api_cache').select(['value', 'fetched_at']).where('key', '=', key).executeTakeFirst();
  if (!row) return refresh(key, fetch);
  if (isFresh(row.fetched_at, maxAge)) return row.value as T;

  // Expired: serve it now and refresh in the background, so only a title's very
  // first view waits on the provider. A failed refresh keeps the old copy.
  refresh(key, fetch).catch((err) => {
    if (!(err instanceof ExternalServiceUnavailableError)) console.error(`api_cache refresh failed for ${key}:`, err);
  });
  return row.value as T;
}

/** Runs `fetch` once per key at a time and saves the result */
function refresh<T>(key: string, fetch: () => Promise<T | DontCache<T>>): Promise<T> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const run = (async () => {
    const result = await fetch();
    if (result instanceof DontCache) return result.value;
    await setCached(key, result);
    return result;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, run);
  return run;
}

/** Fresh copies for several keys at once; missing or expired keys are left out */
export async function getCachedMany<T>(keys: string[], maxAge: number): Promise<Map<string, T>> {
  if (keys.length === 0) return new Map();
  const rows = await db.selectFrom('api_cache').select(['key', 'value', 'fetched_at']).where('key', 'in', keys).execute();
  return new Map(rows.filter((r) => isFresh(r.fetched_at, maxAge)).map((r) => [r.key, r.value as T]));
}

export function setCached(key: string, value: unknown) {
  return setCachedMany([[key, value]]);
}

/** Saves several entries in one statement (e.g. the same season list under every season's key) */
export async function setCachedMany(entries: Array<[string, unknown]>): Promise<void> {
  if (entries.length === 0) return;
  const fetchedAt = new Date();
  await db
    .insertInto('api_cache')
    .values(entries.map(([key, value]) => ({ key, value: jsonb(value), fetched_at: fetchedAt })))
    .onConflict((oc) =>
      oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value'), fetched_at: eb.ref('excluded.fetched_at') }))
    )
    .execute();
}
