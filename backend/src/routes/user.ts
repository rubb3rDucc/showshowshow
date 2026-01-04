import { db } from '../db/index.js';
import { authenticateClerk } from '../plugins/clerk-auth.js';
import type { FastifyInstance } from 'fastify';

export const userRoutes = async (fastify: FastifyInstance) => {
  // Note: Email, password, and account deletion are now handled by Clerk
  // All user account management is done through Clerk's UserProfile component
  // This file is kept for potential future user-related endpoints
};
