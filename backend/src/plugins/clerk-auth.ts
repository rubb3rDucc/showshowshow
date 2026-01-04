import { verifyToken } from '@clerk/backend';
import type { FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../lib/errors.js';
import { db } from '../db/index.js';

// Extend FastifyRequest to include user with Clerk details
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      clerkUserId: string;
      email: string;
      isAdmin: boolean;
    };
  }
}

/**
 * Clerk authentication middleware
 * Verifies Clerk JWT token and looks up user in database
 */
export async function authenticateClerk(request: FastifyRequest) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No authentication token provided');
  }

  const token = authHeader.substring(7);

  try {
    // Verify the Clerk JWT token
    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const clerkUserId = decoded.sub;
    const email = decoded.email as string;
    const isAdmin = decoded.isAdmin === true;

    // Look up the user in our database by clerk_user_id
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'is_admin', 'clerk_user_id'])
      .where('clerk_user_id', '=', clerkUserId)
      .executeTakeFirst();

    if (!user) {
      throw new UnauthorizedError('User not found in database');
    }

    // Attach user info to request
    request.user = {
      userId: user.id,
      clerkUserId: clerkUserId,
      email: user.email,
      isAdmin: user.is_admin,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    // Clerk token verification failed
    throw new UnauthorizedError('Invalid authentication token');
  }
}

/**
 * Require admin role middleware
 * Must be used after authenticateClerk
 */
export async function requireClerkAdmin(request: FastifyRequest) {
  await authenticateClerk(request);

  if (!request.user?.isAdmin) {
    throw new UnauthorizedError('Admin access required');
  }
}
