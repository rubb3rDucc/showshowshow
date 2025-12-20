/**
 * Environment detection utilities
 * Helps differentiate between local development, staging, and production
 */

export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Get the current environment
 * Checks NODE_ENV and other indicators
 */
export function getEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  
  // Explicit production
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return 'production';
  }
  
  // Explicit staging
  if (nodeEnv === 'staging' || nodeEnv === 'stage') {
    return 'staging';
  }
  
  // Explicit test
  if (nodeEnv === 'test') {
    return 'test';
  }
  
  // Check for production indicators
  if (process.env.RAILWAY_ENVIRONMENT === 'production' ||
      process.env.RENDER === 'true' ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.FLY_APP_NAME ||
      process.env.DIGITALOCEAN_APP_ID || // DigitalOcean App Platform
      (process.env.NODE_ENV === 'production' && process.env.PORT)) { // Generic production with PORT set
    return 'production';
  }
  
  // Check for staging indicators
  if (process.env.RAILWAY_ENVIRONMENT === 'staging' ||
      process.env.VERCEL_ENV === 'preview') {
    return 'staging';
  }
  
  // Default to development
  return 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
  return getEnvironment() === 'staging';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return getEnvironment() === 'test';
}

/**
 * Check if running in a deployed environment (staging or production)
 */
export function isDeployed(): boolean {
  const env = getEnvironment();
  return env === 'production' || env === 'staging';
}

/**
 * Get environment-specific configuration
 */
export function getEnvConfig() {
  const env = getEnvironment();
  
  return {
    environment: env,
    isProduction: env === 'production',
    isStaging: env === 'staging',
    isDevelopment: env === 'development',
    isTest: env === 'test',
    isDeployed: env === 'production' || env === 'staging',
    // Platform detection
    platform: process.env.RAILWAY_ENVIRONMENT ? 'railway' :
              process.env.RENDER ? 'render' :
              process.env.VERCEL ? 'vercel' :
              process.env.FLY_APP_NAME ? 'fly.io' :
              'local',
  };
}
