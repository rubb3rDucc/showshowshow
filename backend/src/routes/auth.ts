import { db } from '../db/index.js';
import { hashPassword, verifyPassword, generateToken } from '../lib/auth.js';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export const authRoutes = async (fastify: FastifyInstance) => {
  // Register rate limiting for auth routes (5 attempts per 15 minutes)
  const timeWindow = process.env.NODE_ENV === 'development' ? '1 minute' : '15 minutes';
  
  await fastify.register(rateLimit, {
    max: 5,
    timeWindow: timeWindow,
    global: true, // Apply to all routes in this scope
    errorResponseBuilder: (request, context) => {
      return {
        code: 429,
        error: 'Too Many Requests',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: context.ttl,
      };
    },
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for'];
      const ip = forwarded 
        ? (forwarded as string).split(',')[0]?.trim() 
        : request.ip;
      return `auth:${ip}`;
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // Register
  fastify.post('/register', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    // Validate input
    if (!email || !password) {
      // Track registration failure
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('registration_failed', {
        distinctId: 'anonymous',
        properties: {
          error_type: 'validation_error',
          missing_field: !email ? 'email' : 'password',
        },
      });

      return reply.code(400).send({
        error: 'Email and password are required',
      });
    }

    if (password.length < 8) {
      // Track registration failure
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('registration_failed', {
        distinctId: 'anonymous',
        properties: {
          error_type: 'validation_error',
          validation_error: 'password_too_short',
        },
      });

      return reply.code(400).send({
        error: 'Password must be at least 8 characters',
      });
    }

    // Check if user already exists
    const existingUser = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email.toLowerCase().trim())
      .executeTakeFirst();

    if (existingUser) {
      // Track registration failure
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('registration_failed', {
        distinctId: 'anonymous',
        properties: {
          error_type: 'user_already_exists',
          email_domain: email.split('@')[1], // Anonymized
        },
      });

      return reply.code(409).send({
        error: 'User with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user (Kysely will use defaults for id, created_at, updated_at)
    const user = await db
      .insertInto('users')
      .values({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        is_admin: false, // New users are not admins by default
        id: crypto.randomUUID(), // Generate UUID
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning(['id', 'email', 'created_at'])
      .executeTakeFirstOrThrow();

    // Create default user preferences
    await db
      .insertInto('user_preferences')
      .values({
        id: crypto.randomUUID(),
        user_id: user.id,
        include_reruns: false,
        rerun_frequency: 'rarely',
        max_shows_per_time_slot: 1,
        time_slot_duration: 30,
        allow_overlap: false,
        default_start_time: '18:00',
        default_end_time: '00:00',
        onboarding_completed: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    // Generate token
    const token = generateToken(user.id);

    // Identify user in PostHog for MAU tracking
    const { identifyUser } = await import('../lib/posthog.js');
    identifyUser(user.id, {
      email_domain: user.email.split('@')[1], // Anonymized email domain
      account_created_at: user.created_at.toISOString(),
    });

    // Track registration event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('user_registered', {
      distinctId: user.id,
      properties: {
        email_domain: user.email.split('@')[1], // Anonymized
      },
    });

    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    });
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    // Validate input
    if (!email || !password) {
      // Track login failure
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('login_failed', {
        distinctId: 'anonymous',
        properties: {
          error_type: 'validation_error',
          missing_field: !email ? 'email' : 'password',
        },
      });

      return reply.code(400).send({
        error: 'Email and password are required',
      });
    }

    // Find user
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'password_hash', 'created_at'])
      .where('email', '=', email.toLowerCase().trim())
      .executeTakeFirst();

    if (!user) {
      // Track login failure
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('login_failed', {
        distinctId: 'anonymous',
        properties: {
          error_type: 'user_not_found',
          email_domain: email.split('@')[1], // Anonymized
        },
      });

      return reply.code(401).send({
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      // Track login failure
      const { captureEvent } = await import('../lib/posthog.js');
      captureEvent('login_failed', {
        distinctId: 'anonymous',
        properties: {
          error_type: 'invalid_password',
          email_domain: email.split('@')[1], // Anonymized
        },
      });

      return reply.code(401).send({
        error: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Identify user in PostHog for MAU tracking
    const { identifyUser, captureEvent } = await import('../lib/posthog.js');
    identifyUser(user.id, {
      email_domain: user.email.split('@')[1], // Anonymized email domain
      account_created_at: user.created_at.toISOString(),
      last_login: new Date().toISOString(),
    });

    // Track login event (this counts toward MAU)
    captureEvent('user_logged_in', {
      distinctId: user.id,
      properties: {
        method: 'email',
      },
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    });
  });

  // Get current user (protected route)
  fastify.get('/me', async (request, reply) => {
    // This will be protected with authentication middleware
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({
        error: 'No token provided',
      });
    }

    const { verifyToken } = await import('../lib/auth.js');
    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.code(401).send({
        error: 'Invalid token',
      });
    }

    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'created_at'])
      .where('id', '=', decoded.userId)
      .executeTakeFirst();

    if (!user) {
      return reply.code(404).send({
        error: 'User not found',
      });
    }

    // Track session verification event
    const { captureEvent } = await import('../lib/posthog.js');
    captureEvent('user_session_verified', {
      distinctId: user.id,
      properties: {},
    });

    return reply.send({ user });
  });
};

