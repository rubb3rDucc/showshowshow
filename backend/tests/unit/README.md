# Unit Tests

This directory contains unit tests for pure functions and business logic that don't require:
- API keys (TMDB)
- Database connections
- External services
- Network requests

## Test Files

### `schedule-generator.test.ts`
Tests for pure functions in the schedule generator:
- `parseTime()` - Time string parsing
- `addMinutes()` - Date arithmetic
- `generateTimeSlots()` - Time slot generation (including midnight crossover)

### `auth.test.ts`
Tests for authentication utilities:
- `hashPassword()` - Password hashing
- `verifyPassword()` - Password verification
- `generateToken()` - JWT token generation
- `verifyToken()` - JWT token verification
- `extractTokenFromHeader()` - Header parsing

### `tmdb-helpers.test.ts`
Tests for TMDB helper functions (pure functions, no API calls):
- `getImageUrl()` - Image URL generation
- `getContentType()` - Content type determination
- `getDefaultDuration()` - Duration calculation

### `errors.test.ts`
Tests for custom error classes:
- `AppError` - Base error class
- `NotFoundError` - 404 errors
- `ValidationError` - 400 errors
- `UnauthorizedError` - 401 errors
- `ForbiddenError` - 403 errors
- `ConflictError` - 409 errors

## Running Unit Tests

```bash
# Run all unit tests
pnpm test:run tests/unit

# Run specific test file
pnpm test:run tests/unit/auth.test.ts

# Run in watch mode
pnpm test:watch tests/unit
```

## Benefits

1. **Fast**: No network or database overhead
2. **Reliable**: No external dependencies
3. **CI/CD Friendly**: Can run in any environment
4. **Pre-commit Hooks**: Fast enough for git hooks
5. **Isolated**: Test individual functions in isolation

## Coverage Goals

These unit tests should cover:
- ✅ All pure functions (no side effects)
- ✅ Helper/utility functions
- ✅ Error classes
- ✅ Validation logic
- ✅ Business logic that can be isolated

## Future Additions

Consider adding unit tests for:
- Date/time manipulation functions
- String formatting utilities
- Data transformation functions
- Validation schemas (if using Zod)
- Business rule calculations




