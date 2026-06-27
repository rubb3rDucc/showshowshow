import { describe, it, expect } from 'vitest';
import {
  dbTypeToApiType,
  apiTypeToDbType,
  type DbContentType,
  type ApiContentType,
} from '../../src/lib/content-type.js';

describe('content-type mapping', () => {
  it('maps DB content_type -> TMDB/API type', () => {
    expect(dbTypeToApiType('show')).toBe('tv');
    expect(dbTypeToApiType('movie')).toBe('movie');
  });

  it('maps TMDB/API type -> DB content_type', () => {
    expect(apiTypeToDbType('tv')).toBe('show');
    expect(apiTypeToDbType('movie')).toBe('movie');
  });

  it('round-trips both directions', () => {
    const dbTypes: DbContentType[] = ['show', 'movie'];
    const apiTypes: ApiContentType[] = ['tv', 'movie'];
    for (const t of dbTypes) expect(apiTypeToDbType(dbTypeToApiType(t))).toBe(t);
    for (const t of apiTypes) expect(dbTypeToApiType(apiTypeToDbType(t))).toBe(t);
  });

  // Regression: a content row cached as a 'show' MUST be treated as a match when the
  // API is asked for type 'tv'. The original bug mapped 'show' to a bogus 'series',
  // so `existingType !== 'tv'` was always true and the GET handler deleted-and-refetched
  // the show on every view — cascade-wiping the user's library link. Guard the invariant
  // that drives the "is this the same content, or the other TMDB type?" decision.
  it('treats a cached show as type "tv" (no spurious wrong-type correction)', () => {
    const cachedShowType: DbContentType = 'show';
    const requestedApiType: ApiContentType = 'tv';
    expect(dbTypeToApiType(cachedShowType)).toBe(requestedApiType);
    expect(dbTypeToApiType(cachedShowType) !== requestedApiType).toBe(false);
  });

  it('treats a cached movie as type "movie"', () => {
    expect(dbTypeToApiType('movie') !== ('movie' as ApiContentType)).toBe(false);
  });
});
