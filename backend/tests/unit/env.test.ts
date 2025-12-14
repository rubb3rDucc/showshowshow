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
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: DATABASE_URL');
  });

  it('should fail when JWT_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    delete process.env.JWT_SECRET;
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: JWT_SECRET');
  });

  it('should fail when TMDB_API_KEY is missing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    delete process.env.TMDB_API_KEY;

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: TMDB_API_KEY');
  });

  it('should fail when DATABASE_URL has invalid format', () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DATABASE_URL must start with "postgresql://" or "postgres://"');
  });

  it('should fail when JWT_SECRET is too short in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'short';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('JWT_SECRET must be at least 32 characters in production');
  });

  it('should fail when JWT_SECRET is default value in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'dev-secret-key-change-in-production';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('JWT_SECRET must be changed from default value in production');
  });

  it('should warn when JWT_SECRET is weak in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'dev-secret-key-change-in-production';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('JWT_SECRET'))).toBe(true);
  });

  it('should fail when PORT is invalid', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.PORT = 'invalid';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('PORT'))).toBe(true);
  });

  it('should accept postgres:// prefix for DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
