import { AppError, DatabaseConnectionError } from '../lib/errors.js';
import { captureException } from '../lib/posthog.js';
import { isProduction } from '../lib/env-detection.js';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const errorHandler = async (fastify: FastifyInstance) => {
  // Set custom error serializer to prevent Fastify from adding default error fields
  fastify.setErrorHandler((error, request: FastifyRequest, reply) => {
    // Remove error message from error object to prevent Fastify from serializing it
    // We'll send our own sanitized message instead
    const originalMessage = error instanceof Error ? error.message : undefined;
    if (error instanceof Error && isProduction() && (error instanceof AppError ? error.statusCode >= 500 : true)) {
      // Temporarily clear message to prevent Fastify from including it
      Object.defineProperty(error, 'message', {
        value: '',
        writable: true,
        configurable: true,
      });
    }
    // Always log full error details server-side
    fastify.log.error(error);

    // Detect database connection errors (should always be captured)
    // Use originalMessage since error.message may have been cleared for production
    const isDatabaseError = error instanceof Error && (
      (originalMessage?.includes('timeout exceeded when trying to connect') ?? false) ||
      (originalMessage?.includes('connection') ?? false) ||
      (originalMessage?.includes('ECONNREFUSED') ?? false) ||
      error.stack?.includes('pg-pool') ||
      error.stack?.includes('postgres') ||
      error.stack?.includes('kysely')
    );

    // Capture exception in PostHog (only for non-4xx errors or AppErrors)
    // Database errors should always be captured
    const shouldCapture = isDatabaseError ||
      (!(error instanceof AppError && error.statusCode < 500) && 
       !(error && typeof error === 'object' && 'validation' in error) &&
       !(error && typeof error === 'object' && 'name' in error && error.name === 'JsonWebTokenError'));

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
          isDatabaseError: isDatabaseError,
        },
      });
    }

    // Handle custom AppError
    if (error instanceof AppError) {
      // In production, sanitize error messages for 5xx errors
      // Keep user-friendly messages for 4xx errors (client errors)
      const isServerError = error.statusCode >= 500;
      const sanitizedMessage = isProduction() && isServerError
        ? 'An internal error occurred'
        : error.message;

      // Send custom error response
      // Use reply.send() with a plain object to prevent Fastify from serializing the Error
      const response = {
        error: sanitizedMessage,
        code: error.code, // Error codes are safe to expose
      };
      
      return reply
        .code(error.statusCode)
        .type('application/json')
        .send(response);
    }

    // Handle Fastify validation errors
    if (error && typeof error === 'object' && 'validation' in error) {
      const validationError = error as { validation?: unknown };
      
      // In production, don't expose validation details
      if (isProduction()) {
        return reply
          .code(400)
          .type('application/json')
          .send({
            error: 'Validation error',
            code: 'VALIDATION_ERROR',
          });
      }

      // In development, show validation details for debugging
      return reply
        .code(400)
        .type('application/json')
        .send({
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: validationError.validation,
        });
    }

    // Handle JWT errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'JsonWebTokenError') {
      return reply
        .code(401)
        .type('application/json')
        .send({
          error: 'Invalid token',
          code: 'UNAUTHORIZED',
        });
    }

    // Handle database connection errors specifically
    // Hide technical details from users but log fully for debugging
    if (error instanceof Error) {
      // Use originalMessage since error.message may have been cleared for production
      const errorMessageLower = (originalMessage ?? '').toLowerCase();
      const errorCode = (error as any).code; // PostgreSQL error code
      const isConnectionError =
        errorMessageLower.includes('max client connections') ||
        (errorMessageLower.includes('connection') && errorMessageLower.includes('reached')) ||
        errorMessageLower.includes('too many clients') ||
        errorMessageLower.includes('connection pool') ||
        errorCode === 'XX000' || // PostgreSQL error code for connection issues
        errorCode === '53300'; // PostgreSQL error code for too many connections

      if (isConnectionError) {
        // Log full error details for debugging (you'll see this)
        fastify.log.error({
          type: 'DATABASE_CONNECTION_ERROR',
          message: error.message,
          stack: error.stack,
          code: errorCode,
          userId: request.user?.userId,
          url: request.url,
          method: request.method,
        });

        // Capture in PostHog with full details
        captureException(error, {
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers as Record<string, string>,
            userId: request.user?.userId,
          },
          extra: {
            errorType: 'DATABASE_CONNECTION_ERROR',
            originalMessage: error.message,
            code: errorCode,
          },
        });

        // Return user-friendly message (users won't see technical details)
        return reply
          .code(503) // Service Unavailable
          .type('application/json')
          .send({
            error: isProduction()
              ? 'Service temporarily unavailable. Please try again in a moment.'
              : error.message, // Show details in dev
            code: 'SERVICE_UNAVAILABLE',
          });
      }
    }

    // Default error (500) - never expose details in production
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return reply
      .code(500)
      .type('application/json')
      .send({
        error: isProduction()
          ? 'Internal server error'
          : errorMessage,
        code: 'INTERNAL_ERROR',
      });
  });
};

// Export with fastify-plugin to break encapsulation
// This allows the error handler to apply to sibling plugins (routes)
export const errorHandlerPlugin = fp(errorHandler, {
  name: 'error-handler',
  fastify: '5.x',
});

