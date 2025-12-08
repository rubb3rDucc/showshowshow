import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword, generateToken } from '../lib/auth.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    // Validate input
    if (!email || !password) {
      return reply.code(400).send({
        error: 'Email and password are required',
      });
    }

    if (password.length < 8) {
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
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    // Validate input
    if (!email || !password) {
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
      return reply.code(401).send({
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return reply.code(401).send({
        error: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user.id);

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
  fastify.get('/api/auth/me', async (request, reply) => {
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

    return reply.send({ user });
  });
};

