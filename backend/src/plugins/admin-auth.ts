import { db } from '../db/index.js';
import { authenticate } from './auth.js';
import { UnauthorizedError } from '../lib/errors.js';
import type { FastifyRequest } from 'fastify';

/**
 * Admin authentication middleware
 * Requires user to be authenticated AND have is_admin = true
 */
export async function requireAdmin(request: FastifyRequest) {
  // First check authentication
  await authenticate(request);

  if (!request.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Check if user is admin
  const user = await db
    .selectFrom('users')
    .select('is_admin')
    .where('id', '=', request.user.userId)
    .executeTakeFirst();

  if (!user || !user.is_admin) {
    throw new UnauthorizedError('Admin access required');
  }
}

