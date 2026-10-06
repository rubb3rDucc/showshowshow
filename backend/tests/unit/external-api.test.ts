/**
 * Unit tests for the shared third-party API guard
 * (timeout, kill switch, circuit breaker)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExternalApi } from '../../src/lib/external-api.js';
import { ExternalServiceUnavailableError } from '../../src/lib/errors.js';

const URL = 'https://provider.test/thing';

function respond(status: number) {
  return vi.fn().mockResolvedValue(new Response('{}', { status }));
}

describe('createExternalApi', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns 2xx and 4xx responses to the caller', async () => {
    const api = createExternalApi({ name: 'Passthrough', timeoutMs: 1000 });

    vi.stubGlobal('fetch', respond(200));
    expect((await api.request(URL)).status).toBe(200);

    vi.stubGlobal('fetch', respond(404));
    expect((await api.request(URL)).status).toBe(404);
  });

  it('fails fast without calling fetch when disabled', async () => {
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);
    const api = createExternalApi({ name: 'Off', timeoutMs: 1000, enabled: false });

    await expect(api.request(URL)).rejects.toBeInstanceOf(ExternalServiceUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(api.status().enabled).toBe(false);
  });

  it('turns a hung request into a 503 error after the timeout', async () => {
    vi.useRealTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));
    const api = createExternalApi({ name: 'Slow', timeoutMs: 20 });

    const error = await api.request(URL).catch(e => e);
    expect(error).toBeInstanceOf(ExternalServiceUnavailableError);
    expect(error.statusCode).toBe(503);
    expect(error.message).toContain('timed out');
  });

  it('opens the breaker after repeated outages and then fails fast', async () => {
    const fetchMock = respond(503);
    vi.stubGlobal('fetch', fetchMock);
    const api = createExternalApi({ name: 'Flaky', timeoutMs: 1000, failureThreshold: 3, cooldownMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      await expect(api.request(URL)).rejects.toBeInstanceOf(ExternalServiceUnavailableError);
    }
    expect(api.status().breaker).toBe('open');

    await expect(api.request(URL)).rejects.toThrow('retrying shortly');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('counts network errors as outages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const api = createExternalApi({ name: 'Unreachable', timeoutMs: 1000, failureThreshold: 2 });

    await expect(api.request(URL)).rejects.toThrow('Unreachable unreachable');
    await expect(api.request(URL)).rejects.toThrow();
    expect(api.status().breaker).toBe('open');
  });

  it('does not trip the breaker on 4xx responses', async () => {
    vi.stubGlobal('fetch', respond(429));
    const api = createExternalApi({ name: 'RateLimited', timeoutMs: 1000, failureThreshold: 2 });

    for (let i = 0; i < 5; i++) await api.request(URL);
    expect(api.status()).toMatchObject({ breaker: 'closed', consecutive_failures: 0 });
  });

  it('lets a request through after the cooldown and closes on success', async () => {
    vi.stubGlobal('fetch', respond(500));
    const api = createExternalApi({ name: 'Recovers', timeoutMs: 1000, failureThreshold: 1, cooldownMs: 60_000 });

    await expect(api.request(URL)).rejects.toThrow();
    expect(api.status().breaker).toBe('open');

    vi.advanceTimersByTime(60_001);
    vi.stubGlobal('fetch', respond(200));
    expect((await api.request(URL)).status).toBe(200);
    expect(api.status()).toMatchObject({ breaker: 'closed', consecutive_failures: 0 });
  });
});
