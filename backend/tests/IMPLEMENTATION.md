# Test Implementation Guide

## Overview

This document explains how the shell script tests (`toonami-tests.sh`) were converted to TypeScript/JavaScript tests using Vitest.

## Why Vitest?

**Vitest** was chosen as the testing framework because:

1. **Modern & Fast**: Built on Vite, extremely fast test execution
2. **TypeScript Native**: Works seamlessly with TypeScript and ES modules
3. **Jest-Compatible API**: Easy to learn if you know Jest
4. **Native Fetch**: Built-in fetch API support (perfect for HTTP testing)
5. **Great DX**: Excellent IDE integration, watch mode, coverage

### Alternatives Considered

- **Jest**: More established but can have issues with ES modules
- **Mocha + Chai**: More traditional, requires more setup
- **Node Test Runner**: Built-in but less feature-rich

## Architecture

### Test Structure

```
tests/
├── setup/
│   └── test-helpers.ts    # Reusable API helper functions
├── toonami.test.ts        # Main integration test suite
├── README.md              # Test documentation
└── IMPLEMENTATION.md      # This file
```

### Helper Functions (`test-helpers.ts`)

The helper functions provide a clean abstraction over HTTP requests:

**Before (Shell Script)**:
```bash
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"toonami@test.com","password":"password123"}' \
  | jq -r '.token')
```

**After (TypeScript)**:
```typescript
const token = await authenticateUser('toonami@test.com', 'password123');
```

### Benefits

1. **Type Safety**: TypeScript catches errors at compile time
2. **Reusability**: Helper functions can be used across multiple test files
3. **Maintainability**: Changes to API structure only need updates in one place
4. **Readability**: Tests are more concise and easier to understand
5. **Error Handling**: Better error messages and stack traces

## Test Organization

Tests are organized using Vitest's `describe` blocks, mirroring the shell script's step-by-step structure:

```typescript
describe('Toonami Show Tests', () => {
  // Shared state (token, content IDs)
  
  describe('Step 2: Fetch and Cache Toonami Shows', () => {
    it('should fetch and cache Dragon Ball Z', async () => {
      // Test implementation
    });
  });
  
  describe('Step 6: Generate Schedule from Queue', () => {
    afterEach(async () => {
      // Cleanup after each test
    });
    
    it('should generate schedule with round_robin rotation', async () => {
      // Test implementation
    });
  });
});
```

## Key Differences from Shell Script

### 1. Error Handling

**Shell Script**: Manual error checking with `if` statements
```bash
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token"
  exit 1
fi
```

**TypeScript**: Assertions with descriptive messages
```typescript
expect(token).toBeTruthy();
expect(response.status).toBe(200);
```

### 2. JSON Parsing

**Shell Script**: Using `jq`
```bash
DBZ_CONTENT_ID=$(echo $DBZ_CONTENT | jq -r '.id')
```

**TypeScript**: Direct object access
```typescript
const dbzContentId = response.data.id;
```

### 3. Cleanup

**Shell Script**: Manual cleanup functions
```bash
delete_schedule_for_date() {
  # Complex bash logic
}
```

**TypeScript**: `afterEach` hooks
```typescript
afterEach(async () => {
  await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
  await clearQueue(token);
});
```

### 4. Parallel Execution

**Shell Script**: Sequential execution only

**TypeScript**: Can run tests in parallel (with proper isolation)

## Running Tests

### Prerequisites

1. Server must be running: `pnpm run dev`
2. Database must be set up and migrations run
3. Dependencies installed: `pnpm install`

### Commands

```bash
# Run all tests once
pnpm test:run

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run specific test file
pnpm test toonami

# Run with coverage
pnpm test:run --coverage
```

## Environment Variables

- `TEST_BASE_URL`: Override the base URL (default: `http://localhost:3000`)

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data in `afterEach` hooks
3. **Assertions**: Use descriptive assertions with clear error messages
4. **Timeouts**: Set appropriate timeouts for slow operations (API calls)
5. **Organization**: Group related tests in `describe` blocks

## Future Enhancements

1. **Test Database**: Use a separate test database for isolation
2. **Fixtures**: Create test fixtures for common data
3. **Mocking**: Mock external APIs (TMDB) for faster tests
4. **Coverage**: Add coverage reporting
5. **CI/CD**: Integrate with GitHub Actions

## Migration Checklist

- [x] Install Vitest
- [x] Create test helper functions
- [x] Convert shell script tests to TypeScript
- [x] Add cleanup hooks
- [x] Add proper assertions
- [x] Document test setup
- [ ] Add CI/CD integration
- [ ] Add test coverage reporting
- [ ] Consider test database setup

