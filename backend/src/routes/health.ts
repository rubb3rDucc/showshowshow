import type { FastifyInstance } from 'fastify';
import { testConnection } from '../db/index.js';
import { listExternalApis } from '../lib/external-api.js';

const DB_CHECK_TIMEOUT_MS = 2000;
const PROBE_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function checkDatabase() {
  const start = Date.now();
  try {
    await withTimeout(testConnection(), DB_CHECK_TIMEOUT_MS, 'Database check');
    return { status: 'ok' as const, latency_ms: Date.now() - start };
  } catch (error) {
    return {
      status: 'error' as const,
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export const healthRoutes = async (fastify: FastifyInstance) => {
  // Liveness/readiness, used by the DO App Platform health check to decide
  // routing. Checks only the database, the one dependency that should take the
  // site down. Third-party APIs live in /health/deps: a hung provider must
  // never fail this check (2026-10-06 outage: Jikan hung, every probe timed
  // out, DO pulled every instance).
  fastify.get('/health', async (_request, reply) => {
    const database = await checkDatabase();
    const status = database.status === 'ok' ? 'ok' : 'error';
    if (status === 'error') reply.code(503);
    return {
      status,
      timestamp: new Date().toISOString(),
      services: { database },
    };
  });

  // Informational status of each third-party API, for monitoring and
  // debugging. Always 200; never gate routing on this route.
  fastify.get('/health/deps', async () => {
    const apis = listExternalApis();
    const services = await Promise.all(apis.map(async (api) => {
      const state = api.status();
      if (!state.enabled || !api.probe) return { ...state, status: state.enabled ? 'unknown' : 'disabled' };

      const start = Date.now();
      try {
        await withTimeout(api.probe(), PROBE_TIMEOUT_MS, `${state.name} probe`);
        return { ...api.status(), status: 'ok', latency_ms: Date.now() - start };
      } catch (error) {
        return {
          ...api.status(),
          status: 'error',
          latency_ms: Date.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }));

    const degraded = services.some(s => s.status === 'error');
    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      services,
    };
  });
};
