/**
 * Contract test for the anime API provider (live network).
 *
 * Runs our real client and transforms against whatever ANIME_API_BASE_URL
 * points at, so a provider can be checked before it goes live:
 *
 *   pnpm test:contract:anime
 *   ANIME_API_BASE_URL=https://other.provider/v4 pnpm test:contract:anime
 *
 * Skipped in the normal test run (needs network and hits a third party).
 */

import { describe, it, expect, beforeAll } from 'vitest';

const RUN = process.env.ANIME_CONTRACT === '1';

// Well-known MAL IDs with stable data
const FRIEREN = 52991; // TV, finished, 28 eps
const SPIRITED_AWAY = 199; // Movie
const ONE_PIECE = 21; // long-running, paginated episodes

describe.skipIf(!RUN)('Anime provider contract', () => {
  let client: typeof import('../../src/lib/jikan.js');

  beforeAll(async () => {
    process.env.ANIME_API_ENABLED = 'true';
    client = await import('../../src/lib/jikan.js');
    console.log(`Anime provider under test: ${client.ANIME_API_BASE_URL}`);
  });

  it('search returns relevant, well-formed results', async () => {
    const result = await client.searchJikan('frieren');

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.total_pages).toBeGreaterThanOrEqual(1);
    expect(result.results.some((a: any) => a.mal_id === FRIEREN)).toBe(true);

    const formatted = client.jikanSearchToSearchResult(result.results[0]);
    expect(formatted.mal_id).toEqual(expect.any(Number));
    expect(formatted.title).not.toBe('Unknown');
    expect(formatted.poster_url).toMatch(/^https:\/\//);
    expect(['tv', 'movie']).toContain(formatted.media_type);
  });

  it('search with no matches returns an empty list, not an error', async () => {
    // One nonsense token: multi-word queries fuzzy-match common words
    const result = await client.searchJikan('zzqxjvwkpl');
    expect(result.results).toEqual([]);
  });

  it('TV details map to our content format', async () => {
    const content = client.jikanToContentFormat(await client.getAnimeDetails(FRIEREN));

    expect(content).toMatchObject({ mal_id: FRIEREN, content_type: 'show' });
    expect(content.title).not.toBe('Unknown');
    expect(content.poster_url).toMatch(/^https:\/\//);
    expect(content.first_air_date).toBeInstanceOf(Date);
    expect(content.number_of_episodes).toBeGreaterThan(0);
    expect(content.default_duration).toBeGreaterThan(10);
    expect(content.default_duration).toBeLessThan(60);
    expect(content.status).toBe('finished_airing');
    expect(content.rating).toMatch(/^(TV-)?(Y7?|G|PG|PG-13|14|MA|R|NC-17)$/);
  });

  it('movie details map to a movie with a total runtime', async () => {
    const content = client.jikanToContentFormat(await client.getAnimeDetails(SPIRITED_AWAY));

    expect(content.content_type).toBe('movie');
    expect(content.release_date).toBeInstanceOf(Date);
    expect(content.default_duration).toBeGreaterThan(60);
  });

  it('episodes are listed with titles and paginate', async () => {
    const first = await client.getAnimeEpisodes(ONE_PIECE, 1);

    expect(first.episodes.length).toBeGreaterThan(0);
    expect(first.episodes[0].title).toEqual(expect.any(String));
    expect(first.pagination.last_visible_page).toBeGreaterThan(1);

    const second = await client.getAnimeEpisodes(ONE_PIECE, 2);
    expect(second.episodes.length).toBeGreaterThan(0);
    expect(second.episodes[0].mal_id).not.toBe(first.episodes[0].mal_id);
  });

  it('an unknown ID is a not-found error, not an outage', async () => {
    await expect(client.getAnimeDetails(99_999_999)).rejects.toThrow('Anime not found');
  });
});
