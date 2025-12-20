/**
 * PostHog error tracking integration
 * Only initializes if POSTHOG_API_KEY is set
 * Automatically detects environment (development/staging/production)
 */

import { PostHog } from 'posthog-node';
import { getEnvironment, isDevelopment, isTest } from './env-detection.js';

let posthogClient: PostHog | null = null;

/**
 * Initialize PostHog client if API key is provided
 * Skips initialization in development unless POSTHOG_ENABLE_DEV is set
 */
export function initPostHog(): PostHog | null {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
  const env = getEnvironment();
  const enableDev = process.env.POSTHOG_ENABLE_DEV === 'true';

  // Skip in test environment
  if (isTest()) {
    console.log('ℹ️  PostHog disabled in test environment');
    return null;
  }

  if (!apiKey) {
    console.log('ℹ️  PostHog not configured (POSTHOG_API_KEY not set)');
    return null;
  }

  if (!apiKey.startsWith('phc_')) {
    console.warn('⚠️  PostHog API key format looks incorrect (should start with "phc_")');
  }

  try {
    posthogClient = new PostHog(apiKey, {
      host,
      flushAt: 1, // Flush immediately for errors
      flushInterval: 0, // Don't batch, send immediately
      // Add error handler to catch PostHog errors
      onError: (error) => {
        console.error('❌ PostHog error:', error);
      },
    });

    console.log(`✅ PostHog error tracking initialized (environment: ${env}, host: ${host})`);
    
    // Test the connection with a test event
    try {
      posthogClient.capture({
        distinctId: env, // Use environment name as distinctId (development/production/staging)
        event: 'posthog_initialized',
        properties: {
          environment: env,
          timestamp: new Date().toISOString(),
        },
      });
      posthogClient.flush();
      console.log('✅ PostHog test event sent successfully');
    } catch (testError) {
      console.warn('⚠️  PostHog test event failed (this may be normal):', testError);
    }
    
    return posthogClient;
  } catch (error) {
    console.error('❌ Failed to initialize PostHog:', error);
    return null;
  }
}

/**
 * Get PostHog client instance
 */
export function getPostHog(): PostHog | null {
  return posthogClient;
}

/**
 * Capture an exception in PostHog
 */
export function captureException(
  error: Error,
  context?: {
    request?: {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      userId?: string;
    };
    extra?: Record<string, unknown>;
  }
): void {
  if (!posthogClient) {
    // Log that PostHog is not available (for debugging)
    if (process.env.NODE_ENV === 'development' || process.env.POSTHOG_ENABLE_DEV === 'true') {
      console.log('⚠️  PostHog not initialized, skipping exception capture');
    }
    return;
  }

  try {
    const env = getEnvironment();
    const properties: Record<string, unknown> = {
      $exception_type: error.name,
      $exception_message: error.message,
      $exception_stack_trace: error.stack,
      environment: env, // Tag with environment for filtering in PostHog
      ...context?.extra,
    };

    // Add request context if available
    if (context?.request) {
      properties.$exception_request_method = context.request.method;
      properties.$exception_request_url = context.request.url;
      
      if (context.request.userId) {
        properties.distinct_id = context.request.userId;
      }
    }

    // Capture exception with environment tag
    posthogClient.capture({
      distinctId: context?.request?.userId || 'anonymous',
      event: '$exception',
      properties,
      groups: {
        environment: env, // Group by environment in PostHog
      },
    });

    // Flush immediately to ensure error is sent
    posthogClient.flush();
    
    // Log in development to confirm it's working
    if (process.env.NODE_ENV === 'development' || process.env.POSTHOG_ENABLE_DEV === 'true') {
      console.log('📊 PostHog exception captured:', {
        event: '$exception',
        error: error.message,
        environment: env,
      });
    }
  } catch (err) {
    // Don't let PostHog errors break the app
    console.error('❌ Failed to capture exception in PostHog:', err);
  }
}

/**
 * Shutdown PostHog client gracefully
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    try {
      await posthogClient.shutdown();
      console.log('✅ PostHog shutdown complete');
    } catch (error) {
      console.error('❌ Error shutting down PostHog:', error);
    }
  }
}
