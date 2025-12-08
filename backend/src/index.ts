import Fastify from 'fastify';
import { db, testConnection, closeConnection } from './db/index.js';

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

// Type declaration for TypeScript
declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db;
  }
}

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
    
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    await fastify.listen({ port, host });
    
    console.log(`🚀 Server running on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/health`);
    console.log(`🧪 Test endpoint: http://${host}:${port}/api/test`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

