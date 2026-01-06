/**
 * Environment variable validation
 * Validates all required environment variables on startup
 * Fails fast with clear error messages if any are missing
 */

interface EnvConfig {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  TMDB_API_KEY: string;
  PORT?: string;
  NODE_ENV?: string;
  TMDB_API_BASE_URL?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates all required environment variables
 * @returns ValidationResult with errors and warnings
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const required: Array<keyof EnvConfig> = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'CLERK_PUBLISHABLE_KEY',
    'CLERK_WEBHOOK_SECRET',
    'TMDB_API_KEY',
  ];

  // Check required variables
  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      errors.push('DATABASE_URL must start with "postgresql://" or "postgres://"');
    }
  }

  // Validate Clerk keys format
  if (process.env.CLERK_SECRET_KEY) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey.startsWith('sk_')) {
      warnings.push('CLERK_SECRET_KEY should start with "sk_" - verify it is correct');
    }
  }

  if (process.env.CLERK_PUBLISHABLE_KEY) {
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
    if (!publishableKey.startsWith('pk_')) {
      warnings.push('CLERK_PUBLISHABLE_KEY should start with "pk_" - verify it is correct');
    }
  }

  if (process.env.CLERK_WEBHOOK_SECRET) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret.startsWith('whsec_')) {
      warnings.push('CLERK_WEBHOOK_SECRET should start with "whsec_" - verify it is correct');
    }
  }

  // Validate PORT if provided
  if (process.env.PORT) {
    const port = Number(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT must be a number between 1 and 65535, got: ${process.env.PORT}`);
    }
  }

  // Validate NODE_ENV if provided
  if (process.env.NODE_ENV) {
    const validEnvs = ['development', 'production', 'test'];
    if (!validEnvs.includes(process.env.NODE_ENV)) {
      warnings.push(`NODE_ENV should be one of: ${validEnvs.join(', ')}, got: ${process.env.NODE_ENV}`);
    }
  }

  // Validate TMDB_API_KEY format (basic check)
  if (process.env.TMDB_API_KEY) {
    const apiKey = process.env.TMDB_API_KEY;
    if (apiKey.length < 20) {
      warnings.push('TMDB_API_KEY seems too short - verify it is correct');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and exits if invalid
 * Call this at application startup
 */
export function validateEnvOrExit(): void {
  const result = validateEnv();

  // Print warnings first
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Environment Variable Warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
    console.warn('');
  }

  // Print errors and exit if invalid
  if (!result.valid) {
    console.error('\n❌ Environment Variable Validation Failed:\n');
    result.errors.forEach((error) => {
      console.error(`   ✗ ${error}`);
    });
    console.error('\n💡 Please set the required environment variables and try again.\n');
    process.exit(1);
  }

  // Success message in development
  if (process.env.NODE_ENV !== 'production' && result.warnings.length === 0) {
    console.log('✅ Environment variables validated successfully');
  }
}

/**
 * Get validated environment configuration
 * Throws if validation fails
 */
export function getEnv(): EnvConfig {
  const result = validateEnv();

  if (!result.valid) {
    throw new Error(`Environment validation failed: ${result.errors.join(', ')}`);
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY!,
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY!,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET!,
    TMDB_API_KEY: process.env.TMDB_API_KEY!,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    TMDB_API_BASE_URL: process.env.TMDB_API_BASE_URL,
  };
}
