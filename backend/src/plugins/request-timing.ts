/**
 * Request timing middleware for performance monitoring
 * Tracks request duration and identifies slow requests
 */

import { captureEvent } from '../lib/posthog.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Extend FastifyRequest to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

// Configurable threshold for slow requests (default: 2000ms)
const SLOW_REQUEST_THRESHOLD_MS = parseInt(
  process.env.SLOW_REQUEST_THRESHOLD_MS || '2000',
  10
);

// Configurable threshold for very slow requests (default: 5000ms)
const VERY_SLOW_REQUEST_THRESHOLD_MS = parseInt(
  process.env.VERY_SLOW_REQUEST_THRESHOLD_MS || '5000',
  10
);

export const requestTimingPlugin = async (fastify: FastifyInstance) => {
  // Track request start time
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = Date.now();
  });

  // Track request duration and identify slow requests
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.startTime) {
      return; // Skip if startTime wasn't set
    }

    const duration = Date.now() - request.startTime;

    // Skip health checks and other system endpoints
    const skipPaths = ['/health', '/api/test'];
    if (skipPaths.some(path => request.url.startsWith(path))) {
      return;
    }

    // Track slow requests
    if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
      const userId = (request as any).user?.userId || 'anonymous';
      const isVerySlow = duration >= VERY_SLOW_REQUEST_THRESHOLD_MS;

      captureEvent(isVerySlow ? 'very_slow_request' : 'slow_request', {
        distinctId: userId,
        properties: {
          method: request.method,
          url: request.url,
          duration_ms: duration,
          status_code: reply.statusCode,
          threshold_ms: isVerySlow ? VERY_SLOW_REQUEST_THRESHOLD_MS : SLOW_REQUEST_THRESHOLD_MS,
          // Include route pattern if available (for grouping similar routes)
          route_pattern: extractRoutePattern(request.url),
        },
      });
    }

    // Log slow requests in production (for debugging)
    if (process.env.NODE_ENV === 'production' && duration >= SLOW_REQUEST_THRESHOLD_MS) {
      fastify.log.warn({
        msg: 'Slow request detected',
        method: request.method,
        url: request.url,
        duration_ms: duration,
        status_code: reply.statusCode,
      });
    }
  });
};

/**
 * Extract route pattern from URL for grouping similar routes
 * Example: /api/queue/123 -> /api/queue/:id
 */
function extractRoutePattern(url: string): string {
  // Remove query parameters
  const path = url.split('?')[0];
  
  // Replace UUIDs and numeric IDs with placeholders
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const numericIdPattern = /\/\d+\//g;
  
  let pattern = path
    .replace(uuidPattern, ':id')
    .replace(numericIdPattern, '/:id/')
    .replace(/\/\d+$/, '/:id'); // Trailing numeric ID
  
  return pattern;
}

