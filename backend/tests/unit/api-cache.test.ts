/**
 * Unit tests for the api_cache read-through helper, against an in-memory stand-in for the table
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, { value: unknown; fetched_at: Date }>();

// Just enough of Kysely's builder for api-cache.ts: one-row select, many-row select, upsert
vi.mock('../../src/db/index.js', () => {
  const selectFrom = () => {
    let keys: string[] = [];
    const q = {
      select: () => q,
      where: (_col: string, op: string, v: string | string[]) => {
        keys = op === 'in' ? (v as string[]) : [v as string];
        return q;
      },
      executeTakeFirst: async () => store.get(keys[0]),
      execute: async () => keys.filter((k) => store.has(k)).map((k) => ({ key: k, ...store.get(k)! })),
    };
    return q;
  };
  const insertInto = () => {
    let rows: Array<{ key: string; value: any; fetched_at: Date }> = [];
    const q = {
      values: (v: typeof rows) => ((rows = v), q),
      onConflict: () => q,
      execute: async () => {
        // jsonb(value) is a sql template; its first parameter is the JSON text
        for (const r of rows) {
          const json = r.value.toOperationNode().parameters[0].value;
          store.set(r.key, { value: JSON.parse(json), fetched_at: r.fetched_at });
        }
      },
    };
    return q;
  };
  return { db: { selectFrom, insertInto } };
});

const { cached, dontCache, getCachedMany, setCachedMany, DAY } = await import('../../src/lib/api-cache.js');
const { ExternalServiceUnavailableError } = await import('../../src/lib/errors.js');

const ago = (ms: number) => new Date(Date.now() - ms);

describe('api cache', () => {
  beforeEach(() => store.clear());

  it('returns a fresh copy without fetching', async () => {
    store.set('k', { value: { a: 1 }, fetched_at: ago(DAY) });
    const fetch = vi.fn();
    expect(await cached('k', 7 * DAY, fetch)).toEqual({ a: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches, saves and returns a missing copy', async () => {
    expect(await cached('k', DAY, async () => [1, 2])).toEqual([1, 2]);
    expect(store.get('k')?.value).toEqual([1, 2]); // arrays round-trip as JSON, not Postgres arrays
  });

  it('serves an expired copy at once and refreshes it in the background', async () => {
    store.set('k', { value: 'old', fetched_at: ago(8 * DAY) });
    expect(await cached('k', 7 * DAY, async () => 'new')).toBe('old');
    await vi.waitFor(() => expect(store.get('k')?.value).toBe('new'));
  });

  it('keeps the expired copy when the background refresh fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.set('down', { value: 'stale', fetched_at: ago(30 * DAY) });
    store.set('broken', { value: 'stale', fetched_at: ago(30 * DAY) });

    expect(
      await cached('down', DAY, async () => {
        throw new ExternalServiceUnavailableError('Anime API');
      })
    ).toBe('stale');
    expect(
      await cached('broken', DAY, async () => {
        throw new Error('mapper bug');
      })
    ).toBe('stale');

    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledTimes(1)); // outages are expected; bugs are logged
    expect(store.get('down')?.value).toBe('stale');
    errorLog.mockRestore();
  });

  it('propagates errors when there is no copy to fall back on', async () => {
    await expect(
      cached('missing', DAY, async () => {
        throw new ExternalServiceUnavailableError('Anime API');
      })
    ).rejects.toBeInstanceOf(ExternalServiceUnavailableError);
  });

  it('shares one fetch between concurrent callers', async () => {
    let release!: (v: string) => void;
    const fetch = vi.fn(() => new Promise<string>((r) => (release = r)));
    const a = cached('k', DAY, fetch);
    const b = cached('k', DAY, fetch);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    release('once');
    expect(await Promise.all([a, b])).toEqual(['once', 'once']);
  });

  it('returns but does not save a dontCache result', async () => {
    expect(await cached('k', DAY, async () => dontCache('partial'))).toBe('partial');
    expect(store.has('k')).toBe(false);
  });

  it('reads and writes several keys at once, skipping expired ones', async () => {
    await setCachedMany([
      ['a', 1],
      ['b', 2],
    ]);
    store.set('old', { value: 3, fetched_at: ago(10 * DAY) });
    const got = await getCachedMany(['a', 'b', 'old', 'none'], DAY);
    expect([...got.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});
