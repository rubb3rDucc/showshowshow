/**
 * RLS Context Plugin
 * Sets PostgreSQL session variables for Row Level Security enforcement
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { setUserContext, clearUserContext } from '../db/rls-context.js';
import { SYSTEM_USER_ID } from '../lib/constants.js';

/**
 * Fastify plugin that sets RLS context for authenticated requests
 *
 * - For authenticated users: sets their user ID as context
 * - For unauthenticated requests: no context set (RLS will block access)
 * - Clears context after response to keep connection pool clean
 */
export const rlsContextPlugin = async (fastify: FastifyInstance) => {
  // Set user context before route handlers run
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    // Skip if no authenticated user (public routes)
    if (!request.user?.userId) {
      return;
    }

    // Set the user context for RLS policies
    await setUserContext(request.user.userId);
  });

  // Clear context after response completes
  // This ensures connection pool connections are clean
  fastify.addHook('onResponse', async (request: FastifyRequest) => {
    // Only clear if we set a context
    if (request.user?.userId) {
      await clearUserContext();
    }
  });
};

/**
 * Helper to set system context for webhook/background operations
 * Use this in routes that need to bypass normal user-based RLS
 */
export async function setSystemContext(): Promise<void> {
  await setUserContext(SYSTEM_USER_ID);
}
