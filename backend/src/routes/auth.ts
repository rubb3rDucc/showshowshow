import { db } from '../db/index.js';
import { authenticateClerk } from '../plugins/clerk-auth.js';
import type { FastifyInstance } from 'fastify';

export const authRoutes = async (fastify: FastifyInstance) => {
  // Note: Registration and login are now handled by Clerk
  // Users sign up/login through Clerk's SignIn and SignUp components

  // Get current user (protected route)
  fastify.get('/me', { preHandler: authenticateClerk }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
      });
    }

    const userId = request.user.userId;

    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'created_at', 'is_admin'])
      .where('id', '=', userId)
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
      properties: {
        auth_provider: 'clerk',
      },
    });

    return reply.send({ user });
  });
};
