import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv } from '../../src/lib/env.js';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should pass validation with all required variables', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: DATABASE_URL');
  });

  it('should fail when CLERK_SECRET_KEY is missing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    delete process.env.CLERK_SECRET_KEY;
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: CLERK_SECRET_KEY');
  });

  it('should fail when TMDB_API_KEY is missing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    delete process.env.TMDB_API_KEY;

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: TMDB_API_KEY');
  });

  it('should fail when DATABASE_URL has invalid format', () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DATABASE_URL must start with "postgresql://" or "postgres://"');
  });

  it('should warn when CLERK_SECRET_KEY has invalid prefix', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'invalid_key_format';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.warnings.some(w => w.includes('CLERK_SECRET_KEY should start with "sk_"'))).toBe(true);
  });

  it('should warn when CLERK_PUBLISHABLE_KEY has invalid prefix', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'invalid_key_format';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.warnings.some(w => w.includes('CLERK_PUBLISHABLE_KEY should start with "pk_"'))).toBe(true);
  });

  it('should fail when PORT is invalid', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.PORT = 'invalid';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('PORT'))).toBe(true);
  });

  it('should accept postgres:// prefix for DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
