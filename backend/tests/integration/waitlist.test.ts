/**
 * Integration tests for waitlist routes
 * Tests POST /api/waitlist endpoint
 *
 * Note: GET /api/waitlist requires Clerk admin auth which needs mocking
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { db } from '../../src/db/index.js';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { ValidationError } from '../../src/lib/errors.js';

/**
 * Create a simplified waitlist route for testing
 * (without Clerk auth dependency for admin routes)
 */
async function createWaitlistRoutes(fastify: FastifyInstance) {
  // Rate limiting: 3 signups per hour per IP
  await fastify.register(rateLimit, {
    max: 3,
    timeWindow: '1 hour',
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for'];
      const ip = forwarded
        ? (forwarded as string).split(',')[0]?.trim()
        : request.ip;
      return `waitlist:${ip}`;
    },
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        code: 'RATE_LIMITED',
        error: 'Too Many Requests',
        message: 'Too many signup attempts. Please try again later.',
        retryAfter: context.ttl,
      };
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // Sign up for waitlist
  fastify.post('/api/waitlist', async (request, reply) => {
    const { email, source = 'landing_page' } = request.body as {
      email?: string;
      source?: string;
    };

    if (!email) {
      throw new ValidationError('Email is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already on waitlist
    const existing = await db
      .selectFrom('waitlist')
      .select('id')
      .where('email', '=', normalizedEmail)
      .executeTakeFirst();

    if (existing) {
      return reply.send({
        success: true,
        message: "You're already on the waitlist! We'll notify you when ShowShowShow launches.",
      });
    }

    // Add to waitlist
    const result = await db
      .insertInto('waitlist')
      .values({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        source: source,
        code_used: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning(['id', 'email', 'created_at'])
      .executeTakeFirst();

    return reply.send({
      success: true,
      message: "Thanks! We'll notify you when ShowShowShow launches.",
      id: result?.id,
    });
  });
}

describe('Waitlist Routes', () => {
  let app: FastifyInstance;
  const testEmails: string[] = [];

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.decorate('db', db);
    await app.register(errorHandlerPlugin);
    await createWaitlistRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test entries
    if (testEmails.length > 0) {
      await db
        .deleteFrom('waitlist')
        .where('email', 'in', testEmails)
        .execute();
    }
    await app.close();
  });

  describe('POST /api/waitlist', () => {
    it('should successfully add email to waitlist', async () => {
      const email = `test-${Date.now()}@example.com`;
      testEmails.push(email.toLowerCase());

      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('notify you');
      expect(body.id).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const email = `TEST-UPPER-${Date.now()}@EXAMPLE.COM`;
      const normalizedEmail = email.toLowerCase();
      testEmails.push(normalizedEmail);

      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email },
      });

      expect(response.statusCode).toBe(200);

      // Verify stored in lowercase
      const stored = await db
        .selectFrom('waitlist')
        .select('email')
        .where('email', '=', normalizedEmail)
        .executeTakeFirst();

      expect(stored?.email).toBe(normalizedEmail);
    });

    it('should handle duplicate email gracefully', async () => {
      const uniqueIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const email = `duplicate-${Date.now()}@example.com`;
      testEmails.push(email.toLowerCase());

      // First signup
      await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email },
        headers: { 'x-forwarded-for': uniqueIp },
      });

      // Second signup with same email (doesn't count against rate limit since same email)
      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email },
        headers: { 'x-forwarded-for': uniqueIp },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('already on the waitlist');
    });

    it('should reject missing email', async () => {
      const uniqueIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: {},
        headers: { 'x-forwarded-for': uniqueIp },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid email format', async () => {
      const uniqueIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email: 'not-an-email' },
        headers: { 'x-forwarded-for': uniqueIp },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toContain('Invalid email');
    });

    it('should reject email without @ symbol', async () => {
      const uniqueIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email: 'testexample.com' },
        headers: { 'x-forwarded-for': uniqueIp },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject email without domain', async () => {
      const uniqueIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email: 'test@' },
        headers: { 'x-forwarded-for': uniqueIp },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept custom source parameter', async () => {
      const timestamp = Date.now();
      const email = `source-test-${timestamp}@example.com`;
      const normalizedEmail = email.toLowerCase();
      testEmails.push(normalizedEmail);

      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email, source: 'twitter_campaign' },
        headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 255)}.1` },
      });

      expect(response.statusCode).toBe(200);

      // Verify source was stored
      const stored = await db
        .selectFrom('waitlist')
        .select('source')
        .where('email', '=', normalizedEmail)
        .executeTakeFirst();

      expect(stored).toBeDefined();
      expect(stored?.source).toBe('twitter_campaign');
    });

    it('should use default source when not provided', async () => {
      const timestamp = Date.now();
      const email = `default-source-${timestamp}@example.com`;
      const normalizedEmail = email.toLowerCase();
      testEmails.push(normalizedEmail);

      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email },
        headers: { 'x-forwarded-for': `10.2.${Math.floor(Math.random() * 255)}.1` },
      });

      expect(response.statusCode).toBe(200);

      const stored = await db
        .selectFrom('waitlist')
        .select('source')
        .where('email', '=', normalizedEmail)
        .executeTakeFirst();

      expect(stored).toBeDefined();
      expect(stored?.source).toBe('landing_page');
    });

    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email: 'invalid' },
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const email = `ratelimit-test-${Date.now()}@example.com`;
      testEmails.push(email.toLowerCase());

      const response = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email },
        headers: { 'x-forwarded-for': '192.168.50.50' },
      });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should enforce rate limit after 3 requests', async () => {
      // Create a fresh app instance for this test WITHOUT the error handler
      // The rate-limit plugin sends its own response, so error handler isn't needed
      const rateLimitApp = Fastify({ logger: false });
      rateLimitApp.decorate('db', db);
      // Note: Don't register errorHandlerPlugin here - rate limit handles its own response
      await createWaitlistRoutes(rateLimitApp);
      await rateLimitApp.ready();

      try {
        // Use a completely unique IP
        const uniqueIp = `172.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const baseTimestamp = Date.now();

        // Make 3 requests (the limit) - all must succeed
        for (let i = 0; i < 3; i++) {
          const email = `ratelimit-exhaust-${baseTimestamp}-${i}@example.com`;
          testEmails.push(email.toLowerCase());

          const resp = await rateLimitApp.inject({
            method: 'POST',
            url: '/api/waitlist',
            payload: { email },
            headers: { 'x-forwarded-for': uniqueIp },
          });
          expect(resp.statusCode).toBe(200);
        }

        // 4th request should be rate limited
        const response = await rateLimitApp.inject({
          method: 'POST',
          url: '/api/waitlist',
          payload: { email: `blocked-${baseTimestamp}@example.com` },
          headers: { 'x-forwarded-for': uniqueIp },
        });

        expect(response.statusCode).toBe(429);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Too Many Requests');
      } finally {
        await rateLimitApp.close();
      }
    });

    it('should have separate rate limits per IP', async () => {
      const ip1 = `10.${Math.floor(Math.random() * 255)}.0.1`;
      const ip2 = `10.${Math.floor(Math.random() * 255)}.0.2`;

      const email1 = `unique-ip1-${Date.now()}@example.com`;
      const email2 = `unique-ip2-${Date.now()}@example.com`;
      testEmails.push(email1.toLowerCase(), email2.toLowerCase());

      // IP 1 - should succeed
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email: email1 },
        headers: { 'x-forwarded-for': ip1 },
      });

      // IP 2 - should also succeed (different rate limit bucket)
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/waitlist',
        payload: { email: email2 },
        headers: { 'x-forwarded-for': ip2 },
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
    });
  });
});
