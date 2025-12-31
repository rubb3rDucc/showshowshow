import { db } from '../db/index.js';
import rateLimit from '@fastify/rate-limit';
import { ValidationError } from '../lib/errors.js';
import { requireAdmin } from '../plugins/admin-auth.js';
import type { FastifyInstance } from 'fastify';

export const waitlistRoutes = async (fastify: FastifyInstance) => {
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
        code: 429,
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
      // Already signed up - return success (don't reveal if email exists for privacy)
      return reply.send({ 
        success: true, 
        message: 'You\'re already on the waitlist! We\'ll notify you when ShowShowShow launches.' 
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

    // Track in PostHog (optional)
    try {
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('waitlist_signup', {
        distinctId: 'anonymous',
        properties: {
          email: normalizedEmail,
          source: source,
        },
      });
    } catch (error) {
      // PostHog not critical, continue
      fastify.log.debug({ error }, 'PostHog tracking failed (non-critical)');
    }

    fastify.log.info(`✅ Waitlist signup: ${normalizedEmail} (source: ${source})`);

    return reply.send({ 
      success: true, 
      message: 'Thanks! We\'ll notify you when ShowShowShow launches.',
      id: result?.id 
    });
  });

  // Get all waitlist entries (protected - requires admin)
  fastify.get('/api/waitlist', { preHandler: requireAdmin }, async (request, reply) => {

    const { with_codes_only, limit } = request.query as {
      with_codes_only?: string;
      limit?: string;
    };

    let query = db
      .selectFrom('waitlist')
      .selectAll()
      .orderBy('created_at', 'desc');

    if (with_codes_only === 'true') {
      query = query.where('discount_code', 'is not', null) as any;
    }

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum) as any;
      }
    }

    const entries = await query.execute();

    return reply.send({
      count: entries.length,
      entries: entries,
    });
  });
};

