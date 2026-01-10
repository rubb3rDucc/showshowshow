/**
 * Rate limiting plugin
 * Protects API from abuse and brute force attacks
 */

import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { isDevelopment } from '../lib/env-detection.js';

const globalRateLimiter = async (fastify: FastifyInstance) => {
  // Global rate limiting - more lenient in development
  const globalMax = isDevelopment() ? 1000 : 100; // Higher limit in dev for testing
  const globalTimeWindow = '1 minute';

  await fastify.register(rateLimit, {
    max: globalMax,
    timeWindow: globalTimeWindow,
    global: true, // Apply to all routes by default
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        code: 'RATE_LIMITED',
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry after ${context.ttl} seconds.`,
        retryAfter: context.ttl,
      };
    },
    // Use IP address as key (default behavior)
    keyGenerator: (request) => {
      // Try to get real IP from proxy headers
      const forwarded = request.headers['x-forwarded-for'];
      if (forwarded) {
        const ips = (forwarded as string).split(',');
        return ips[0]?.trim() || request.ip;
      }
      return request.ip;
    },
    // Add rate limit headers to response
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
};

// Export with fastify-plugin to break encapsulation
export const rateLimitPlugin = fp(globalRateLimiter, {
  name: 'global-rate-limit',
  fastify: '5.x',
});

/**
 * Stricter rate limiting for authentication endpoints
 * Prevents brute force attacks on login/register
 */
const authRateLimiter = async (fastify: FastifyInstance) => {
  // In development, use shorter time window for easier testing
  const timeWindow = isDevelopment() ? '1 minute' : '15 minutes';
  
  await fastify.register(rateLimit, {
    max: 5, // Only 5 attempts
    timeWindow: timeWindow,
    global: true, // Apply to all routes in this scope (auth routes)
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        code: 'RATE_LIMITED',
        error: 'Too Many Requests',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: context.ttl,
      };
    },
    keyGenerator: async (request) => {
      // Use IP address for rate limiting
      // All auth endpoints share the same rate limit bucket
      const forwarded = request.headers['x-forwarded-for'];
      const ip = forwarded 
        ? (forwarded as string).split(',')[0]?.trim() 
        : request.ip;
      
      // Use same key for all auth endpoints (login, register, etc.)
      // This prevents trying login 5 times, then register 5 times
      return `auth:${ip}`;
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Use Redis or in-memory store (in-memory is default)
    // In development, this should work fine
  });
};

// Export with fastify-plugin to break encapsulation
export const authRateLimitPlugin = fp(authRateLimiter, {
  name: 'auth-rate-limit',
  fastify: '5.x',
});


