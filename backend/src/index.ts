// Validate environment variables FIRST - fail fast if invalid
import { validateEnvOrExit } from './lib/env.js';
validateEnvOrExit();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db, testConnection, closeConnection } from './db/index.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { contentRoutes } from './routes/content.js';
import { queueRoutes } from './routes/queue.js';
import { scheduleRoutes } from './routes/schedule.js';
import { scheduleGenerateRoutes } from './routes/schedule-generate.js';

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
    // Test database connection
    await testConnection();

    // Register CORS (BEFORE other plugins)
    await fastify.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });                                 

    // Register plugins
    await fastify.register(errorHandlerPlugin);

    // Register routes
    await fastify.register(authRoutes);
    await fastify.register(contentRoutes);
    await fastify.register(queueRoutes);
    await fastify.register(scheduleRoutes);
    await fastify.register(scheduleGenerateRoutes);

    const port = Number(process.env.PORT) || 3000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

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
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

