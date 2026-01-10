/**
 * Unit tests for rate limiting plugins
 * Tests configuration, headers, and actual rate limiting behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { rateLimitPlugin, authRateLimitPlugin } from '../../src/plugins/rate-limit.js';

describe('Rate Limiting', () => {
  describe('Global Rate Limit Plugin', () => {
    let fastify: ReturnType<typeof Fastify>;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
    });

    afterEach(async () => {
      await fastify.close();
    });

    it('should register and allow requests within limit', async () => {
      await fastify.register(rateLimitPlugin);
      fastify.get('/test', async () => ({ ok: true }));
      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should include rate limit headers in response', async () => {
      await fastify.register(rateLimitPlugin);
      fastify.get('/test', async () => ({ ok: true }));
      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      // Verify rate limit headers are present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should decrement remaining count with each request', async () => {
      await fastify.register(rateLimitPlugin);
      fastify.get('/test', async () => ({ ok: true }));
      await fastify.ready();

      const response1 = await fastify.inject({ method: 'GET', url: '/test' });
      const response2 = await fastify.inject({ method: 'GET', url: '/test' });

      const remaining1 = Number(response1.headers['x-ratelimit-remaining']);
      const remaining2 = Number(response2.headers['x-ratelimit-remaining']);

      expect(remaining2).toBe(remaining1 - 1);
    });

    it('should extract IP from X-Forwarded-For header', async () => {
      await fastify.register(rateLimitPlugin);
      fastify.get('/test', async () => ({ ok: true }));
      await fastify.ready();

      // First request from IP 192.168.1.1
      const response1 = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      // Second request from different IP 192.168.1.2
      const response2 = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });

      // Both should get full remaining limit (separate rate limit buckets)
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      // Different IPs should have independent rate limits
      // The limit header should be the same for both
      expect(response1.headers['x-ratelimit-limit']).toBe(response2.headers['x-ratelimit-limit']);
    });

    it('should use first IP from comma-separated X-Forwarded-For', async () => {
      await fastify.register(rateLimitPlugin);
      fastify.get('/test', async () => ({ ok: true }));
      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1, 172.16.0.1' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });

    it('should apply rate limit to all routes', async () => {
      await fastify.register(rateLimitPlugin);
      fastify.get('/route1', async () => ({ route: 1 }));
      fastify.get('/route2', async () => ({ route: 2 }));
      await fastify.ready();

      const response1 = await fastify.inject({ method: 'GET', url: '/route1' });
      const response2 = await fastify.inject({ method: 'GET', url: '/route2' });

      // Both routes should have rate limit headers
      expect(response1.headers['x-ratelimit-limit']).toBeDefined();
      expect(response2.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  describe('Auth Rate Limit Plugin', () => {
    let fastify: ReturnType<typeof Fastify>;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
    });

    afterEach(async () => {
      await fastify.close();
    });

    it('should register and allow requests within limit', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@test.com', password: 'pass' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should include rate limit headers in response', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should have stricter limit than global (5 requests)', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      // Auth limit should be 5
      expect(response.headers['x-ratelimit-limit']).toBe('5');
    });

    it('should return 429 after exceeding limit', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/auth/login',
          payload: {},
        });
        expect(response.statusCode).toBe(200);
      }

      // 6th request should be rate limited
      const blockedResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      expect(blockedResponse.statusCode).toBe(429);
    });

    it('should return custom error response when rate limited', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await fastify.inject({ method: 'POST', url: '/auth/login', payload: {} });
      }

      // Get rate limited response
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toContain('Too many authentication attempts');
      expect(body.retryAfter).toBeDefined();
    });

    it('should include retry-after header when rate limited', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await fastify.inject({ method: 'POST', url: '/auth/login', payload: {} });
      }

      // Get rate limited response
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should share rate limit across all auth endpoints (login and register)', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
        instance.post('/register', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      // Make 3 login requests
      for (let i = 0; i < 3; i++) {
        await fastify.inject({ method: 'POST', url: '/auth/login', payload: {} });
      }

      // Make 2 register requests (total 5)
      for (let i = 0; i < 2; i++) {
        await fastify.inject({ method: 'POST', url: '/auth/register', payload: {} });
      }

      // 6th request (either endpoint) should be blocked
      const blockedLogin = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      const blockedRegister = await fastify.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {},
      });

      expect(blockedLogin.statusCode).toBe(429);
      expect(blockedRegister.statusCode).toBe(429);
    });

    it('should have separate limits for different IPs', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      // Exhaust limit for IP 1
      for (let i = 0; i < 5; i++) {
        await fastify.inject({
          method: 'POST',
          url: '/auth/login',
          headers: { 'x-forwarded-for': '10.0.0.1' },
          payload: {},
        });
      }

      // IP 1 should be blocked
      const blockedResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'x-forwarded-for': '10.0.0.1' },
        payload: {},
      });
      expect(blockedResponse.statusCode).toBe(429);

      // IP 2 should still be allowed
      const allowedResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'x-forwarded-for': '10.0.0.2' },
        payload: {},
      });
      expect(allowedResponse.statusCode).toBe(200);
    });
  });

  describe('Rate Limit Error Response Format', () => {
    let fastify: ReturnType<typeof Fastify>;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
    });

    afterEach(async () => {
      await fastify.close();
    });

    it('should return JSON content type for rate limit errors', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await fastify.inject({ method: 'POST', url: '/auth/login', payload: {} });
      }

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include rate limit code in error response body', async () => {
      await fastify.register(async (instance) => {
        await instance.register(authRateLimitPlugin);
        instance.post('/login', async () => ({ ok: true }));
      }, { prefix: '/auth' });
      await fastify.ready();

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await fastify.inject({ method: 'POST', url: '/auth/login', payload: {} });
      }

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      const body = JSON.parse(response.body);
      expect(body.code).toBe('RATE_LIMITED');
      expect(body.statusCode).toBe(429);
    });
  });
});
