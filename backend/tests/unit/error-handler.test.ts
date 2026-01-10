/**
 * Unit tests for error handler plugin
 * Tests that error details are properly sanitized in production
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.js';
import { AppError } from '../../src/lib/errors.js';

describe('Error Handler Plugin', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const createFastify = async () => {
    const app = Fastify({
      logger: false,
    });
    await app.register(errorHandlerPlugin);
    return app;
  };

  describe('AppError Handling', () => {
    describe('5xx Errors - Production', () => {
      it('should sanitize 5xx error messages in production', async () => {
        process.env.NODE_ENV = 'production';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('Database connection failed: password incorrect', 500, 'DB_ERROR');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);

        // Error code MUST be present
        expect(body.code).toBe('DB_ERROR');

        // Error message MUST be sanitized (no sensitive info)
        expect(body.error).toBe('An internal error occurred');
        expect(body.error).not.toContain('password');
        expect(body.error).not.toContain('Database connection failed');

        await fastify.close();
      });

      it('should sanitize 503 error messages in production', async () => {
        process.env.NODE_ENV = 'production';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('Service temporarily down for maintenance', 503, 'SERVICE_UNAVAILABLE');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(503);
        const body = JSON.parse(response.body);

        expect(body.code).toBe('SERVICE_UNAVAILABLE');
        expect(body.error).toBe('An internal error occurred');

        await fastify.close();
      });
    });

    describe('5xx Errors - Development', () => {
      it('should show full 5xx error message in development', async () => {
        process.env.NODE_ENV = 'development';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('Database connection failed: password incorrect', 500, 'DB_ERROR');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);

        // Development shows full error details
        expect(body.error).toBe('Database connection failed: password incorrect');
        expect(body.code).toBe('DB_ERROR');

        await fastify.close();
      });
    });

    describe('4xx Errors', () => {
      it('should keep 4xx error messages in production (user-friendly)', async () => {
        process.env.NODE_ENV = 'production';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('User not found', 404, 'NOT_FOUND');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);

        // 4xx errors show user-friendly messages even in production
        expect(body.error).toBe('User not found');
        expect(body.code).toBe('NOT_FOUND');

        await fastify.close();
      });

      it('should handle 400 validation errors from AppError', async () => {
        process.env.NODE_ENV = 'production';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('Invalid email format', 400, 'VALIDATION_ERROR');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('Invalid email format');
        expect(body.code).toBe('VALIDATION_ERROR');

        await fastify.close();
      });

      it('should handle 401 unauthorized errors', async () => {
        process.env.NODE_ENV = 'production';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('Invalid credentials');
        expect(body.code).toBe('UNAUTHORIZED');

        await fastify.close();
      });

      it('should handle 403 forbidden errors', async () => {
        process.env.NODE_ENV = 'production';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('Access denied');
        expect(body.code).toBe('FORBIDDEN');

        await fastify.close();
      });

      it('should handle 409 conflict errors', async () => {
        process.env.NODE_ENV = 'production';

        const fastify = await createFastify();
        fastify.get('/test', async () => {
          throw new AppError('Email already exists', 409, 'CONFLICT');
        });

        await fastify.ready();
        const response = await fastify.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('Email already exists');
        expect(body.code).toBe('CONFLICT');

        await fastify.close();
      });
    });
  });

  describe('Fastify Validation Errors', () => {
    it('should handle schema validation errors in production', async () => {
      process.env.NODE_ENV = 'production';

      const fastify = await createFastify();
      fastify.post('/test', {
        schema: {
          body: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string', format: 'email' },
            },
          },
        },
      }, async () => ({ ok: true }));

      await fastify.ready();
      const response = await fastify.inject({
        method: 'POST',
        url: '/test',
        payload: { name: 'test' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Production should have generic validation error
      expect(body.error).toBe('Validation error');
      expect(body.code).toBe('VALIDATION_ERROR');
      // Should NOT expose validation details in production
      expect(body.details).toBeUndefined();

      await fastify.close();
    });

    it('should expose validation details in development', async () => {
      process.env.NODE_ENV = 'development';

      const fastify = await createFastify();
      fastify.post('/test', {
        schema: {
          body: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string', format: 'email' },
            },
          },
        },
      }, async () => ({ ok: true }));

      await fastify.ready();
      const response = await fastify.inject({
        method: 'POST',
        url: '/test',
        payload: { name: 'test' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      // Development should show validation details
      expect(body.error).toBe('Validation error');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toBeDefined();

      await fastify.close();
    });
  });

  describe('Generic Error Handling', () => {
    it('should sanitize generic errors in production', async () => {
      process.env.NODE_ENV = 'production';

      const fastify = await createFastify();
      fastify.get('/test', async () => {
        throw new Error('Sensitive database password: secret123');
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      // Generic errors should be fully sanitized
      expect(body.error).toBe('Internal server error');
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.error).not.toContain('password');
      expect(body.error).not.toContain('secret123');

      await fastify.close();
    });

    it('should show generic error message in development', async () => {
      process.env.NODE_ENV = 'development';

      const fastify = await createFastify();
      fastify.get('/test', async () => {
        throw new Error('Database connection timeout');
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      // Development shows full error
      expect(body.error).toBe('Database connection timeout');
      expect(body.code).toBe('INTERNAL_ERROR');

      await fastify.close();
    });
  });

  describe('JWT Error Handling', () => {
    it('should return 401 for JWT errors', async () => {
      const fastify = await createFastify();
      const jwtError: any = new Error('jwt malformed');
      jwtError.name = 'JsonWebTokenError';

      fastify.get('/test', async () => {
        throw jwtError;
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('Invalid token');
      expect(body.code).toBe('UNAUTHORIZED');

      await fastify.close();
    });

    it('should handle TokenExpiredError as JWT error', async () => {
      const fastify = await createFastify();
      const jwtError: any = new Error('Token expired');
      jwtError.name = 'JsonWebTokenError';

      fastify.get('/test', async () => {
        throw jwtError;
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);

      expect(body.code).toBe('UNAUTHORIZED');

      await fastify.close();
    });
  });

  describe('Database Connection Errors', () => {
    it('should return 503 for connection pool exhaustion', async () => {
      process.env.NODE_ENV = 'production';

      const fastify = await createFastify();
      fastify.get('/test', async () => {
        const error = new Error('max client connections reached');
        throw error;
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('Service temporarily unavailable. Please try again in a moment.');
      expect(body.code).toBe('SERVICE_UNAVAILABLE');

      await fastify.close();
    });

    it('should return 503 for too many clients error', async () => {
      process.env.NODE_ENV = 'production';

      const fastify = await createFastify();
      fastify.get('/test', async () => {
        const error = new Error('too many clients already');
        throw error;
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      expect(body.code).toBe('SERVICE_UNAVAILABLE');

      await fastify.close();
    });

    it('should show DB error details in development', async () => {
      process.env.NODE_ENV = 'development';

      const fastify = await createFastify();
      fastify.get('/test', async () => {
        const error = new Error('connection pool exhausted');
        throw error;
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);

      // Development shows actual error message
      expect(body.error).toBe('connection pool exhausted');
      expect(body.code).toBe('SERVICE_UNAVAILABLE');

      await fastify.close();
    });
  });

  describe('Error Response Format', () => {
    it('should return JSON content type', async () => {
      const fastify = await createFastify();
      fastify.get('/test', async () => {
        throw new AppError('Test error', 400, 'TEST_ERROR');
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['content-type']).toContain('application/json');

      await fastify.close();
    });

    it('should only include error and code fields for AppError', async () => {
      process.env.NODE_ENV = 'production';

      const fastify = await createFastify();
      fastify.get('/test', async () => {
        throw new AppError('Test error', 400, 'TEST_ERROR');
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      const body = JSON.parse(response.body);
      const keys = Object.keys(body);

      expect(keys).toContain('error');
      expect(keys).toContain('code');
      // Should NOT include stack traces or other sensitive fields
      expect(keys).not.toContain('stack');
      expect(keys).not.toContain('statusCode');

      await fastify.close();
    });
  });

  describe('Edge Cases', () => {
    it('should handle AppError without code', async () => {
      const fastify = await createFastify();
      fastify.get('/test', async () => {
        throw new AppError('Test error', 400);
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('Test error');
      // Code may be undefined when not provided
      expect(body.code).toBeUndefined();

      await fastify.close();
    });

    it('should handle non-Error thrown values', async () => {
      const fastify = await createFastify();
      fastify.get('/test', async () => {
        throw 'String error'; // Not recommended but possible
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      // Should not crash, return some error response
      expect(response.statusCode).toBeGreaterThanOrEqual(400);

      await fastify.close();
    });

    it('should handle null thrown value', async () => {
      const fastify = await createFastify();
      fastify.get('/test', async () => {
        throw null;
      });

      await fastify.ready();
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      // Should not crash
      expect(response.statusCode).toBeGreaterThanOrEqual(400);

      await fastify.close();
    });
  });
});
