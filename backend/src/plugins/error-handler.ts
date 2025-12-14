import { AppError } from '../lib/errors.js';
import { captureException } from '../lib/posthog.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export const errorHandlerPlugin = async (fastify: FastifyInstance) => {
  // Global error handler
  fastify.setErrorHandler((error, request: FastifyRequest, reply) => {
    fastify.log.error(error);

    // Capture exception in PostHog (only for non-4xx errors or AppErrors)
    const shouldCapture = !(error instanceof AppError && error.statusCode < 500) && 
                          !(error && typeof error === 'object' && 'validation' in error) &&
                          !(error && typeof error === 'object' && 'name' in error && error.name === 'JsonWebTokenError');

    if (shouldCapture && error instanceof Error) {
      captureException(error, {
        request: {
          method: request.method,
          url: request.url,
          headers: request.headers as Record<string, string>,
          userId: request.user?.userId,
        },
        extra: {
          statusCode: error instanceof AppError ? error.statusCode : 500,
          errorCode: error instanceof AppError ? error.code : undefined,
        },
      });
    }

    // Handle custom AppError
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        code: error.code,
      });
    }

    // Handle Fastify validation errors
    if (error && typeof error === 'object' && 'validation' in error) {
      return reply.code(400).send({
        error: 'Validation error',
        details: (error as any).validation,
      });
    }

    // Handle JWT errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'JsonWebTokenError') {
      return reply.code(401).send({
        error: 'Invalid token',
      });
    }

    // Default error
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return reply.code(500).send({
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : errorMessage,
    });
  });
};

