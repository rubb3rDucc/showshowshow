/**
 * Reusable mocks for testing
 * Use these mocks to avoid API keys and external dependencies
 */

import { vi } from 'vitest';

/**
 * Mock TMDB API responses
 */
export const mockTMDBResponses = {
  show: {
    id: 12345,
    name: 'Test Show',
    overview: 'A test show for unit testing',
    poster_path: '/test-poster.jpg',
    backdrop_path: '/test-backdrop.jpg',
    first_air_date: '2020-01-01',
    last_air_date: '2023-12-31',
    number_of_seasons: 3,
    number_of_episodes: 36,
    status: 'Ended',
    episode_run_time: [22],
  },
  movie: {
    id: 67890,
    title: 'Test Movie',
    overview: 'A test movie for unit testing',
    poster_path: '/test-movie-poster.jpg',
    backdrop_path: '/test-movie-backdrop.jpg',
    release_date: '2022-06-15',
    runtime: 120,
  },
  season: {
    id: 1,
    name: 'Season 1',
    overview: 'First season',
    season_number: 1,
    episodes: [
      {
        id: 1,
        name: 'Episode 1',
        overview: 'First episode',
        season_number: 1,
        episode_number: 1,
        air_date: '2020-01-01',
        runtime: 22,
        still_path: '/episode1.jpg',
      },
      {
        id: 2,
        name: 'Episode 2',
        overview: 'Second episode',
        season_number: 1,
        episode_number: 2,
        air_date: '2020-01-08',
        runtime: 22,
        still_path: '/episode2.jpg',
      },
    ],
  },
  searchResults: {
    page: 1,
    total_pages: 1,
    total_results: 2,
    results: [
      {
        id: 12345,
        media_type: 'tv',
        name: 'Test Show',
        overview: 'A test show',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        first_air_date: '2020-01-01',
      },
      {
        id: 67890,
        media_type: 'movie',
        title: 'Test Movie',
        overview: 'A test movie',
        poster_path: '/movie-poster.jpg',
        backdrop_path: '/movie-backdrop.jpg',
        release_date: '2022-06-15',
      },
    ],
  },
};

/**
 * Create a mock database query builder
 */
export function createMockQueryBuilder() {
  const chain = {
    selectFrom: vi.fn().mockReturnThis(),
    insertInto: vi.fn().mockReturnThis(),
    updateTable: vi.fn().mockReturnThis(),
    deleteFrom: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    whereRef: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    returningAll: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    executeTakeFirst: vi.fn().mockResolvedValue(null),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({}),
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn((callback) => callback(chain)),
    }),
  };
  return chain;
}

/**
 * Create a mock Fastify request
 */
export function createMockRequest(overrides: Partial<any> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { userId: 'test-user-id' },
    ...overrides,
  };
}

/**
 * Create a mock Fastify reply
 */
export function createMockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return reply;
}

/**
 * Setup environment variables for testing
 */
export function setupTestEnv() {
  vi.stubEnv('TMDB_API_KEY', 'test-api-key');
  vi.stubEnv('JWT_SECRET', 'test-jwt-secret');
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
  vi.stubEnv('NODE_ENV', 'test');
}

/**
 * Cleanup environment variables after testing
 */
export function cleanupTestEnv() {
  vi.unstubAllEnvs();
}




