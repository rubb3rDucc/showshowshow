import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv, getEnv, validateEnvOrExit } from '../../src/lib/env.js';

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

  it('should warn when CLERK_WEBHOOK_SECRET has invalid prefix', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'invalid_webhook_secret';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(true); // Still valid, just a warning
    expect(result.warnings.some(w => w.includes('CLERK_WEBHOOK_SECRET should start with "whsec_"'))).toBe(true);
  });

  it('should warn when NODE_ENV has invalid value', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.NODE_ENV = 'staging';

    const result = validateEnv();

    expect(result.valid).toBe(true); // Still valid, just a warning
    expect(result.warnings.some(w => w.includes('NODE_ENV should be one of'))).toBe(true);
  });

  it('should warn when TMDB_API_KEY is too short', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'short';

    const result = validateEnv();

    expect(result.valid).toBe(true); // Still valid, just a warning
    expect(result.warnings.some(w => w.includes('TMDB_API_KEY seems too short'))).toBe(true);
  });

  it('should fail when required variable is empty string', () => {
    process.env.DATABASE_URL = '';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: DATABASE_URL');
  });

  it('should fail when required variable is whitespace only', () => {
    process.env.DATABASE_URL = '   ';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: DATABASE_URL');
  });

  it('should fail when PORT is out of range (too high)', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.PORT = '70000';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('PORT must be a number between 1 and 65535'))).toBe(true);
  });

  it('should fail when PORT is zero', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.PORT = '0';

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('PORT'))).toBe(true);
  });

  it('should accept valid PORT values', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.PORT = '3000';

    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept valid NODE_ENV values', () => {
    const validEnvs = ['development', 'production', 'test'];

    for (const nodeEnv of validEnvs) {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
      process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
      process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
      process.env.NODE_ENV = nodeEnv;

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.warnings.filter(w => w.includes('NODE_ENV'))).toHaveLength(0);
    }
  });

  it('should fail when multiple required variables are missing', () => {
    delete process.env.DATABASE_URL;
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_WEBHOOK_SECRET;
    delete process.env.TMDB_API_KEY;

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
    expect(result.errors).toContain('Missing required environment variable: DATABASE_URL');
    expect(result.errors).toContain('Missing required environment variable: CLERK_SECRET_KEY');
    expect(result.errors).toContain('Missing required environment variable: CLERK_PUBLISHABLE_KEY');
    expect(result.errors).toContain('Missing required environment variable: CLERK_WEBHOOK_SECRET');
    expect(result.errors).toContain('Missing required environment variable: TMDB_API_KEY');
  });
});

describe('getEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return config when all required variables are present', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.PORT = '3000';
    process.env.NODE_ENV = 'development';

    const config = getEnv();

    expect(config.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(config.CLERK_SECRET_KEY).toBe('sk_test_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(config.CLERK_PUBLISHABLE_KEY).toBe('pk_test_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(config.CLERK_WEBHOOK_SECRET).toBe('whsec_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(config.TMDB_API_KEY).toBe('test-api-key-12345678901234567890');
    expect(config.PORT).toBe('3000');
    expect(config.NODE_ENV).toBe('development');
  });

  it('should throw when validation fails', () => {
    delete process.env.DATABASE_URL;
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    expect(() => getEnv()).toThrow('Environment validation failed');
  });

  it('should include error details in thrown error message', () => {
    delete process.env.DATABASE_URL;
    delete process.env.TMDB_API_KEY;
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';

    expect(() => getEnv()).toThrow(/DATABASE_URL/);
    expect(() => getEnv()).toThrow(/TMDB_API_KEY/);
  });

  it('should return undefined for optional variables when not set', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.TMDB_API_BASE_URL;

    const config = getEnv();

    expect(config.PORT).toBeUndefined();
    expect(config.NODE_ENV).toBeUndefined();
    expect(config.TMDB_API_BASE_URL).toBeUndefined();
  });
});

describe('validateEnvOrExit', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Mock process.exit to prevent actual exit
    process.exit = vi.fn() as never;
    // Mock console methods to suppress output
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });

  it('should call process.exit(1) when validation fails', () => {
    delete process.env.DATABASE_URL;
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    validateEnvOrExit();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should not call process.exit when validation passes', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    validateEnvOrExit();

    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should log errors when validation fails', () => {
    delete process.env.DATABASE_URL;
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    validateEnvOrExit();

    expect(console.error).toHaveBeenCalled();
  });

  it('should log warnings when there are warnings', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'invalid_key';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';

    validateEnvOrExit();

    expect(console.warn).toHaveBeenCalled();
  });

  it('should log success message in development without warnings', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.NODE_ENV = 'development';

    validateEnvOrExit();

    expect(console.log).toHaveBeenCalledWith('✅ Environment variables validated successfully');
  });

  it('should not log success message in production', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CLERK_SECRET_KEY = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_1234567890abcdefghijklmnopqrstuvwxyz';
    process.env.TMDB_API_KEY = 'test-api-key-12345678901234567890';
    process.env.NODE_ENV = 'production';

    validateEnvOrExit();

    expect(console.log).not.toHaveBeenCalledWith('✅ Environment variables validated successfully');
  });
});
