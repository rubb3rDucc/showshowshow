/**
 * Unit tests for /health and /health/deps
 * Regression for the 2026-10-06 outage: a hung third-party API must never
 * fail (or slow down) the health check that DO uses for routing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

const testConnection = vi.fn();
vi.mock('../../src/db/index.js', () => ({ testConnection: () => testConnection() }));

const { healthRoutes } = await import('../../src/routes/health.js');
const { createExternalApi } = await import('../../src/lib/external-api.js');

describe('Health routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    testConnection.mockReset().mockResolvedValue(true);
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 when the database is reachable', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('ok');
    });

    it('returns 503 when the database is down', async () => {
      testConnection.mockRejectedValue(new Error('connection refused'));

      const response = await app.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(503);
      expect(response.json().services.database.error).toBe('connection refused');
    });

    it('stays fast and 200 while a third-party API hangs', async () => {
      const probe = vi.fn(() => new Promise(() => {}));
      createExternalApi({ name: 'Hung provider', timeoutMs: 60_000, probe });

      const start = Date.now();
      const response = await app.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);
      expect(Date.now() - start).toBeLessThan(500);
      expect(probe).not.toHaveBeenCalled();

      // Stays registered for later tests; stop it hanging /health/deps
      probe.mockResolvedValue(true);
    });
  });

  describe('GET /health/deps', () => {
    it('reports each external API and stays 200 when one fails', async () => {
      createExternalApi({ name: 'Healthy provider', timeoutMs: 1000, probe: async () => true });
      createExternalApi({ name: 'Broken provider', timeoutMs: 1000, probe: async () => { throw new Error('boom'); } });
      createExternalApi({ name: 'Disabled provider', timeoutMs: 1000, enabled: false, probe: async () => true });

      const response = await app.inject({ method: 'GET', url: '/health/deps' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('degraded');
      const byName = Object.fromEntries(body.services.map((s: any) => [s.name, s]));
      expect(byName['Healthy provider'].status).toBe('ok');
      expect(byName['Broken provider']).toMatchObject({ status: 'error', error: 'boom' });
      expect(byName['Disabled provider'].status).toBe('disabled');
    });
  });
});
