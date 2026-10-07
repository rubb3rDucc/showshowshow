/**
 * Shared guard for third-party HTTP APIs (TMDB, the anime source, ...).
 *
 * Every call gets a timeout, an optional kill switch, optional request spacing,
 * and a circuit breaker: after repeated outages (timeouts, network errors, 5xx)
 * the service fails fast for a cooldown instead of making each request wait out
 * the timeout. A dead provider then costs a quick 503, not a hung request.
 *
 * 4xx responses are returned to the caller untouched: a 404 or 429 means the
 * provider is up, so they never trip the breaker.
 */

import { ExternalServiceUnavailableError } from './errors.js';

export interface ExternalApiOptions {
  /** Human-readable name, used in errors and /health/deps. */
  name: string;
  timeoutMs: number;
  /** Kill switch. When false, every request fails fast. */
  enabled?: boolean;
  /** Minimum gap between requests, for providers with tight rate limits. */
  minIntervalMs?: number;
  /** Consecutive outages before the breaker opens. */
  failureThreshold?: number;
  /** How long the breaker stays open before letting a request through again. */
  cooldownMs?: number;
  /** Cheap request used by /health/deps to report the provider's status. */
  probe?: () => Promise<unknown>;
}

export interface ExternalApiStatus {
  name: string;
  enabled: boolean;
  breaker: 'open' | 'closed';
  consecutive_failures: number;
}

export interface ExternalApi {
  request(url: string, init?: RequestInit): Promise<Response>;
  status(): ExternalApiStatus;
  probe?: () => Promise<unknown>;
  /** Test-only: clear breaker state. */
  reset(): void;
}

const registry = new Map<string, ExternalApi>();

export function createExternalApi(options: ExternalApiOptions): ExternalApi {
  const {
    name,
    timeoutMs,
    enabled = true,
    minIntervalMs = 0,
    failureThreshold = 3,
    cooldownMs = 60_000,
  } = options;

  let consecutiveFailures = 0;
  let breakerOpenUntil = 0;
  let lastRequestTime = 0;

  const recordFailure = () => {
    consecutiveFailures++;
    if (consecutiveFailures >= failureThreshold) {
      breakerOpenUntil = Date.now() + cooldownMs;
    }
  };

  const api: ExternalApi = {
    async request(url, init) {
      if (!enabled) {
        throw new ExternalServiceUnavailableError(name, `${name} is disabled`);
      }
      if (Date.now() < breakerOpenUntil) {
        throw new ExternalServiceUnavailableError(name, `${name} is unavailable, retrying shortly`);
      }

      if (minIntervalMs > 0) {
        // Reserve a start slot before waiting, so concurrent callers queue up
        // minIntervalMs apart instead of all reading the same time and firing together
        const now = Date.now();
        const slot = Math.max(now, lastRequestTime + minIntervalMs);
        lastRequestTime = slot;
        if (slot > now) await new Promise(resolve => setTimeout(resolve, slot - now));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } catch (error: any) {
        recordFailure();
        const reason = error?.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : 'unreachable';
        throw new ExternalServiceUnavailableError(name, `${name} ${reason}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.status >= 500) {
        recordFailure();
        throw new ExternalServiceUnavailableError(name, `${name} error: ${response.status} ${response.statusText}`);
      }

      consecutiveFailures = 0;
      breakerOpenUntil = 0;
      return response;
    },

    status() {
      return {
        name,
        enabled,
        breaker: Date.now() < breakerOpenUntil ? 'open' : 'closed',
        consecutive_failures: consecutiveFailures,
      };
    },

    probe: options.probe,

    reset() {
      consecutiveFailures = 0;
      breakerOpenUntil = 0;
      lastRequestTime = 0;
    },
  };

  registry.set(name, api);
  return api;
}

/** Every external API created so far, for /health/deps. */
export function listExternalApis(): ExternalApi[] {
  return [...registry.values()];
}
