# Test Suite

This directory contains integration tests for the ShowShowShow backend API.

## Setup

1. **Install dependencies** (includes Vitest):
   ```bash
   pnpm install
   ```

2. **Start your development server** (in a separate terminal):
   ```bash
   pnpm run dev
   ```

3. **Run tests**:
   ```bash
   # Run all tests once
   pnpm test:run
   
   # Run tests in watch mode
   pnpm test:watch
   
   # Or use the shorthand
   pnpm test
   ```

## Test Structure

### `toonami.test.ts`
Integration tests that replicate the functionality of `toonami-tests.sh`. These tests:
- Authenticate users
- Fetch and cache content from TMDB
- Manage queue operations
- Generate schedules with various configurations
- Test edge cases (midnight crossover, multiple shows, movies, etc.)

### `setup/test-helpers.ts`
Reusable helper functions for making API requests:
- `authenticateUser()` - Register/login and get token
- `fetchContent()` - Fetch and cache content from TMDB
- `fetchEpisodes()` - Fetch episodes for a show
- `addToQueue()` / `getQueue()` / `clearQueue()` - Queue management
- `generateScheduleFromQueue()` / `generateScheduleFromShows()` - Schedule generation
- `deleteScheduleForDateRange()` - Cleanup helper
- `getLibrary()` - Get cached content library

## Writing New Tests

Example test structure:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { authenticateUser, fetchContent } from './setup/test-helpers';

describe('My Feature Tests', () => {
  let token: string;

  beforeAll(async () => {
    token = await authenticateUser();
  });

  it('should do something', async () => {
    const response = await fetchContent(12345, token);
    expect(response.status).toBe(200);
  });
});
```

## Configuration

- **Vitest config**: `vitest.config.ts` in the project root
- **Base URL**: Set via `TEST_BASE_URL` environment variable (defaults to `http://localhost:3000`)
- **Timeouts**: 30 seconds for tests, 10 seconds for hooks (sufficient for API calls)

## Advantages Over Shell Scripts

1. **Type Safety**: TypeScript catches errors at compile time
2. **Better Assertions**: Vitest provides rich assertion library
3. **Parallel Execution**: Tests can run in parallel
4. **Better Debugging**: Stack traces, source maps, IDE integration
5. **CI/CD Integration**: Easy to integrate with GitHub Actions, etc.
6. **Test Organization**: Group related tests with `describe` blocks
7. **Automatic Cleanup**: `afterEach` hooks ensure clean state

## Migration from Shell Scripts

The test helpers (`test-helpers.ts`) provide a 1:1 mapping of shell script functionality:
- `curl` → `apiRequest()`
- `jq` parsing → TypeScript object access
- Bash conditionals → Vitest assertions
- Shell functions → TypeScript functions

