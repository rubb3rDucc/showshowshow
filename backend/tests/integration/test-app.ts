/**
 * Test application builder for integration tests
 * Creates a Fastify instance with all plugins and routes registered
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { db } from '../../src/db/index.js';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { rateLimitPlugin } from '../../src/plugins/rate-limit.js';
import { contentRoutes } from '../../src/routes/content.js';
import { queueRoutes } from '../../src/routes/queue.js';
import { scheduleRoutes } from '../../src/routes/schedule.js';
import { scheduleGenerateRoutes } from '../../src/routes/schedule-generate.js';
import { libraryRoutes } from '../../src/routes/library.js';
import { waitlistRoutes } from '../../src/routes/waitlist.js';
import { networkRoutes } from '../../src/routes/networks.js';
import { authRoutes } from '../../src/routes/auth.js';

export interface TestAppOptions {
  /** Skip rate limiting for tests */
  skipRateLimit?: boolean;
  /** Mock user for authenticated routes */
  mockUser?: { userId: string; email?: string; isAdmin?: boolean };
}

/**
 * Build a test Fastify application with all routes
 */
export async function buildTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register database instance
  app.decorate('db', db);

  // Register CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register error handler
  await app.register(errorHandlerPlugin);

  // Rate limiting (optional for tests)
  if (!options.skipRateLimit) {
    await app.register(rateLimitPlugin);
  }

  // Mock authentication if user provided
  if (options.mockUser) {
    app.addHook('preHandler', async (request) => {
      (request as any).user = options.mockUser;
    });
  }

  // Health check endpoint (always available)
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Test endpoint
  app.get('/api/test', async () => ({
    message: 'Backend is running!',
    timestamp: new Date().toISOString(),
  }));

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(contentRoutes);
  await app.register(queueRoutes);
  await app.register(scheduleRoutes);
  await app.register(scheduleGenerateRoutes);
  await app.register(libraryRoutes);
  await app.register(waitlistRoutes);
  await app.register(networkRoutes);

  return app;
}

/**
 * Build a minimal test app for specific route testing
 */
export async function buildMinimalTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(errorHandlerPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/test', async () => ({
    message: 'Backend is running!',
    timestamp: new Date().toISOString(),
  }));

  return app;
}
