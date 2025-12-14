/**
 * Rate limiting plugin
 * Protects API from abuse and brute force attacks
 */

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { isDevelopment } from '../lib/env-detection.js';

export const rateLimitPlugin = async (fastify: FastifyInstance) => {
  // Global rate limiting - more lenient in development
  const globalMax = isDevelopment() ? 1000 : 100; // Higher limit in dev for testing
  const globalTimeWindow = '1 minute';

  await fastify.register(rateLimit, {
    max: globalMax,
    timeWindow: globalTimeWindow,
    errorResponseBuilder: (request, context) => {
      return {
        code: 429,
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

/**
 * Stricter rate limiting for authentication endpoints
 * Prevents brute force attacks on login/register
 */
export const authRateLimitPlugin = async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    max: 5, // Only 5 attempts
    timeWindow: '15 minutes', // Per 15 minutes
    errorResponseBuilder: (request, context) => {
      return {
        code: 429,
        error: 'Too Many Requests',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: context.ttl,
      };
    },
    keyGenerator: (request) => {
      // Use IP + email if available for auth endpoints
      const forwarded = request.headers['x-forwarded-for'];
      const ip = forwarded 
        ? (forwarded as string).split(',')[0]?.trim() 
        : request.ip;
      
      // Try to get email from body for more specific rate limiting
      const body = request.body as { email?: string } | undefined;
      if (body?.email) {
        return `${ip}:${body.email.toLowerCase()}`;
      }
      
      return ip;
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
};
