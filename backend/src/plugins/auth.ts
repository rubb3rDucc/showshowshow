import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { verifyToken, extractTokenFromHeader } from '../lib/auth.js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
    };
  }
}

// Authentication plugin
export const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Authentication decorator
  fastify.decorate('authenticate', async function (request: FastifyRequest) {
    const token = extractTokenFromHeader(request.headers.authorization);

    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      throw new Error('Invalid token');
    }

    // Attach user to request
    request.user = {
      userId: decoded.userId,
    };
  });
};

// Authentication hook (runs before route handler)
export async function authenticate(request: FastifyRequest) {
  const token = extractTokenFromHeader(request.headers.authorization);

  if (!token) {
    throw new Error('No token provided');
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    throw new Error('Invalid token');
  }

  // Attach user to request
  request.user = {
    userId: decoded.userId,
  };
}

