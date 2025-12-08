import { FastifyPluginAsync } from 'fastify';
import { AppError } from '../lib/errors.js';

export const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  // Global error handler
  fastify.setErrorHandler((error: unknown, request, reply) => {
    fastify.log.error(error);

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
        details: (error as { validation: unknown }).validation,
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

