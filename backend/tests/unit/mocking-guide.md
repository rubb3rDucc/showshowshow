# Mocking Guide for Tests

This guide explains how to mock external dependencies (TMDB API, database) for tests that need to run without API keys or external services.

## Why Mock?

1. **No API Keys Required**: Tests can run in CI/CD without exposing secrets
2. **Faster Tests**: No network latency
3. **Reliable**: No dependency on external service availability
4. **Isolated**: Test your code, not external services
5. **Predictable**: Control test data and responses

## Mocking Strategies

### 1. Mock TMDB API Calls

For functions that call TMDB API, use Vitest's `vi.mock()`:

```typescript
import { vi } from 'vitest';
import { getShowDetails, getMovieDetails } from '../../src/lib/tmdb.js';

// Mock the entire tmdb module
vi.mock('../../src/lib/tmdb.js', () => ({
  getShowDetails: vi.fn(),
  getMovieDetails: vi.fn(),
  searchTMDB: vi.fn(),
  getSeason: vi.fn(),
  getImageUrl: vi.fn((path) => path ? `https://image.tmdb.org/t/p/w500${path}` : null),
  getContentType: vi.fn((result) => result.media_type === 'tv' ? 'show' : 'movie'),
  getDefaultDuration: vi.fn((content, type) => type === 'movie' ? 120 : 22),
}));

describe('Content Routes with Mocked TMDB', () => {
  it('should fetch show details', async () => {
    // Setup mock response
    const mockShow = {
      id: 12345,
      name: 'Test Show',
      overview: 'Test overview',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      first_air_date: '2020-01-01',
      number_of_seasons: 2,
      number_of_episodes: 24,
      status: 'Ended',
      episode_run_time: [22],
    };

    vi.mocked(getShowDetails).mockResolvedValue(mockShow);

    // Your test code here
    const result = await getShowDetails(12345);
    expect(result).toEqual(mockShow);
  });
});
```

### 2. Mock Database Calls

For database operations, you can:

#### Option A: Use a Test Database
```typescript
// Use a separate test database
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://...';

beforeAll(async () => {
  // Connect to test database
  // Run migrations
});

afterEach(async () => {
  // Clean up test data
});
```

#### Option B: Mock Kysely Queries
```typescript
import { vi } from 'vitest';
import { db } from '../../src/db/index.js';

vi.mock('../../src/db/index.js', () => ({
  db: {
    selectFrom: vi.fn().mockReturnThis(),
    insertInto: vi.fn().mockReturnThis(),
    updateTable: vi.fn().mockReturnThis(),
    deleteFrom: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    executeTakeFirst: vi.fn().mockResolvedValue(null),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({}),
  },
}));
```

#### Option C: Use an In-Memory Database
```typescript
// Use SQLite in-memory for tests
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
// Setup schema
// Use in tests
```

### 3. Mock Environment Variables

```typescript
import { vi } from 'vitest';

beforeEach(() => {
  vi.stubEnv('TMDB_API_KEY', 'test-api-key');
  vi.stubEnv('JWT_SECRET', 'test-secret');
  vi.stubEnv('DATABASE_URL', 'postgresql://test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

### 4. Mock Fastify Request/Reply

```typescript
import { vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

const mockRequest = {
  body: {},
  params: {},
  query: {},
  headers: {},
  user: { userId: 'test-user-id' },
} as unknown as FastifyRequest;

const mockReply = {
  code: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
} as unknown as FastifyReply;
```

## Example: Complete Mocked Test

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contentRoutes } from '../../src/routes/content.js';
import * as tmdb from '../../src/lib/tmdb.js';

// Mock TMDB
vi.mock('../../src/lib/tmdb.js', () => ({
  getShowDetails: vi.fn(),
  getImageUrl: vi.fn((path) => path ? `https://image.tmdb.org/t/p/w500${path}` : null),
  getDefaultDuration: vi.fn(() => 22),
}));

// Mock database
vi.mock('../../src/db/index.js', () => ({
  db: {
    selectFrom: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(null),
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returningAll: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
      id: 'test-id',
      tmdb_id: 12345,
      title: 'Test Show',
    }),
  },
}));

describe('Content Routes (Mocked)', () => {
  it('should fetch and cache show', async () => {
    const mockShow = {
      id: 12345,
      name: 'Test Show',
      // ... other fields
    };

    vi.mocked(tmdb.getShowDetails).mockResolvedValue(mockShow);

    // Test your route handler
    // ...
  });
});
```

## Best Practices

1. **Mock at Module Level**: Mock entire modules, not individual functions
2. **Reset Mocks**: Use `beforeEach` to reset mocks between tests
3. **Type Safety**: Use `vi.mocked()` for better TypeScript support
4. **Realistic Data**: Use realistic mock data that matches API responses
5. **Test Edge Cases**: Mock error responses, empty results, etc.
6. **Document Mocks**: Comment why you're mocking and what you're testing

## When to Mock vs. Use Real Services

### Mock When:
- ✅ Testing business logic
- ✅ Testing error handling
- ✅ Running in CI/CD
- ✅ Testing edge cases
- ✅ Fast feedback needed

### Use Real Services When:
- ✅ Integration testing
- ✅ End-to-end testing
- ✅ Verifying API compatibility
- ✅ Testing with real data

## Resources

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Vitest API Reference](https://vitest.dev/api/)


