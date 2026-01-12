/**
 * PostHog error tracking integration for frontend
 * Only initializes if VITE_POSTHOG_API_KEY is set
 */

import posthog from 'posthog-js';

let initialized = false;

/**
 * Initialize PostHog client if API key is provided
 */
export function initPostHog(): boolean {
  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  const isDev = import.meta.env.DEV;

  if (initialized) {
    return true;
  }

  if (!apiKey) {
    if (isDev) {
      console.log('ℹ️  PostHog not configured (VITE_POSTHOG_API_KEY not set)');
    }
    return false;
  }

  try {
    posthog.init(apiKey, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false, // Disable autocapture to reduce noise
      persistence: 'localStorage',
      // Respect Do Not Track
      respect_dnt: true,
      // Disable in development unless explicitly enabled
      loaded: (ph) => {
        if (isDev && !import.meta.env.VITE_POSTHOG_ENABLE_DEV) {
          ph.opt_out_capturing();
        }
      },
    });

    initialized = true;

    if (isDev) {
      console.log(`✅ PostHog initialized (host: ${host})`);
    }

    return true;
  } catch (error) {
    if (isDev) {
      console.error('❌ Failed to initialize PostHog:', error);
    }
    return false;
  }
}

/**
 * Capture an exception in PostHog
 */
export function captureException(
  error: Error,
  context?: {
    componentStack?: string;
    extra?: Record<string, unknown>;
  }
): void {
  if (!initialized) {
    return;
  }

  try {
    const properties: Record<string, unknown> = {
      $exception_type: error.name,
      $exception_message: error.message,
      $exception_stack_trace: error.stack,
      source: 'frontend',
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...context?.extra,
    };

    if (context?.componentStack) {
      properties.$exception_component_stack = context.componentStack;
    }

    posthog.capture('$exception', properties);
  } catch {
    // Don't let PostHog errors break the app
  }
}

/**
 * Capture an error from an API call or mutation
 */
export function captureApiError(
  error: Error,
  context: {
    operation: string; // e.g., 'addToLibrary', 'deleteFromQueue'
    extra?: Record<string, unknown>;
  }
): void {
  if (!initialized) {
    return;
  }

  try {
    posthog.capture('api_error', {
      error_name: error.name,
      error_message: error.message,
      operation: context.operation,
      source: 'frontend',
      url: window.location.href,
      ...context.extra,
    });
  } catch {
    // Don't let PostHog errors break the app
  }
}

/**
 * Capture a custom event
 */
export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) {
    return;
  }

  try {
    posthog.capture(eventName, {
      source: 'frontend',
      ...properties,
    });
  } catch {
    // Don't let PostHog errors break the app
  }
}

/**
 * Identify a user (call after login)
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) {
    return;
  }

  try {
    posthog.identify(userId, properties);
  } catch {
    // Don't let PostHog errors break the app
  }
}

/**
 * Reset user identity (call on logout)
 */
export function resetUser(): void {
  if (!initialized) {
    return;
  }

  try {
    posthog.reset();
  } catch {
    // Don't let PostHog errors break the app
  }
}

/**
 * Get the PostHog instance for advanced usage
 */
export function getPostHog(): typeof posthog | null {
  return initialized ? posthog : null;
}