// Validate environment variables FIRST - fail fast if invalid
import { validateEnvOrExit } from './lib/env.js';
validateEnvOrExit();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db, testConnection, closeConnection } from './db/index.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { securityPlugin } from './plugins/security.js';
import { rateLimitPlugin, authRateLimitPlugin } from './plugins/rate-limit.js';
import { requestTimingPlugin } from './plugins/request-timing.js';
import { rlsContextPlugin } from './plugins/rls-context.js';
import { initPostHog, shutdownPostHog } from './lib/posthog.js';
import { initRedis } from './lib/redis.js';
import { getEnvConfig, isProduction } from './lib/env-detection.js';
import { authRoutes } from './routes/auth.js';
import { clerkWebhookRoutes } from './routes/clerk-webhooks.js';
import { contentRoutes } from './routes/content.js';
import { queueRoutes } from './routes/queue.js';
import { scheduleRoutes } from './routes/schedule.js';
import { scheduleGenerateRoutes } from './routes/schedule-generate.js';
import { libraryRoutes } from './routes/library.js';
import { userRoutes } from './routes/user.js';
import { waitlistRoutes } from './routes/waitlist.js';
import { networkRoutes } from './routes/networks.js';
import { peopleRoutes } from './routes/people.js';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register database instance
fastify.decorate('db', db);

// Health check endpoint
fastify.get('/health', async () => {
  try {
    await testConnection();
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Test endpoint
fastify.get('/api/test', async (request, reply) => {
  return {
    message: 'Backend is running!',
    timestamp: new Date().toISOString()
  };
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await fastify.close();
    await closeConnection();
    await shutdownPostHog();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const start = async () => {
  try {
    // Log environment info
    const envConfig = getEnvConfig();
    console.log(`🌍 Environment: ${envConfig.environment} (${envConfig.platform})`);

    // Initialize PostHog error tracking (optional, disabled in dev by default)
    initPostHog();

    // Initialize Redis (graceful degradation if not configured)
    initRedis();

    // Test database connection
    await testConnection();

    // Register security headers (BEFORE CORS and other plugins)
    await fastify.register(securityPlugin);

    // Register CORS (AFTER security, BEFORE other plugins)
    // In production, restrict to frontend URL; in development, allow all
    const frontendUrl = process.env.FRONTEND_URL;
    const landingPageUrl = process.env.LANDING_PAGE_URL; // Landing page domain (e.g., showshowshow.com)

    const corsOrigin = isProduction() && frontendUrl
      ? [
          frontendUrl, // Main app domain
          ...(landingPageUrl ? [landingPageUrl] : []), // Landing page domain
        ]
      : [
          'http://localhost:4173',  // Preview Build frontend
          'http://localhost:5173',  // Local dev frontend
          'http://localhost:5174',  // Docker dev frontend
          'http://localhost:3000',  // Fallback
          'http://localhost:3001',  // Docker backend (for direct access)
          'http://localhost:4321',  // Astro dev server (landing page)
        ]; // Development: allow common localhost ports

    await fastify.register(cors, {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });                                 

    // Register plugins
    await fastify.register(errorHandlerPlugin);
    
    // Register request timing middleware (AFTER error handler, BEFORE routes)
    await fastify.register(requestTimingPlugin);

    // Register global rate limiting (BEFORE routes so route-level configs can override)
    await fastify.register(rateLimitPlugin);

    // Register RLS context plugin (sets user context for Row Level Security)
    await fastify.register(rlsContextPlugin);

    // Register routes
    // Webhook routes - registered BEFORE other routes, no rate limiting or auth
    // Note: Webhook routes set their own system context for RLS bypass
    await fastify.register(clerkWebhookRoutes);

    // Auth routes - rate limiting is configured at route level (overrides global)
    await fastify.register(authRoutes, { prefix: '/api/auth' });

    // Other routes with global rate limiting
    await fastify.register(contentRoutes);
    await fastify.register(queueRoutes);
    await fastify.register(scheduleRoutes);
    await fastify.register(scheduleGenerateRoutes);
    await fastify.register(libraryRoutes);
    await fastify.register(userRoutes);
    await fastify.register(waitlistRoutes);
    await fastify.register(networkRoutes);
    await fastify.register(peopleRoutes);

    const port = Number(process.env.PORT) || 3000;
    // Bind to 0.0.0.0 in Docker or production, localhost otherwise
    const host = process.env.NODE_ENV === 'production' || process.env.DOCKER === 'true' 
      ? '0.0.0.0' 
      : 'localhost';

    await fastify.listen({ port, host });

    console.log(`🚀 Server running on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/health`);
    console.log(`🧪 Test endpoint: http://${host}:${port}/api/test`);
    console.log(`🔐 Auth endpoints:`);
    console.log(`   POST ${host}:${port}/api/auth/register`);
    console.log(`   POST ${host}:${port}/api/auth/login`);
    console.log(`   GET  ${host}:${port}/api/auth/me`);
    console.log(`📺 Content endpoints:`);
    console.log(`   GET  ${host}:${port}/api/content/search?q=query`);
    console.log(`   GET  ${host}:${port}/api/content/:tmdbId`);
    console.log(`   GET  ${host}:${port}/api/content/:tmdbId/episodes`);
    console.log(`   GET  ${host}:${port}/api/content/library`);
    console.log(`📋 Queue endpoints:`);
    console.log(`   GET    ${host}:${port}/api/queue`);
    console.log(`   POST   ${host}:${port}/api/queue`);
    console.log(`   PUT    ${host}:${port}/api/queue/reorder`);
    console.log(`   DELETE ${host}:${port}/api/queue/:id`);
    console.log(`📅 Schedule endpoints:`);
    console.log(`   GET    ${host}:${port}/api/schedule`);
    console.log(`   GET    ${host}:${port}/api/schedule/date/:date`);
    console.log(`   POST   ${host}:${port}/api/schedule`);
    console.log(`   PUT    ${host}:${port}/api/schedule/:id`);
    console.log(`   DELETE ${host}:${port}/api/schedule/:id`);
    console.log(`   POST   ${host}:${port}/api/schedule/:id/watched`);
    console.log(`⚙️  Schedule generation:`);
    console.log(`   POST   ${host}:${port}/api/schedule/generate/queue`);
    console.log(`   POST   ${host}:${port}/api/schedule/generate/shows`);
    console.log(`👤 User settings:`);
    console.log(`   PATCH  ${host}:${port}/api/user/email`);
    console.log(`   PATCH  ${host}:${port}/api/user/password`);
    console.log(`   DELETE ${host}:${port}/api/user/account`);
    console.log(`📧 Waitlist:`);
    console.log(`   POST   ${host}:${port}/api/waitlist`);
    console.log(`   GET    ${host}:${port}/api/waitlist`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

