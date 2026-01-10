/**
 * Unit tests for custom error classes
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  DatabaseConnectionError,
} from '../../src/lib/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default status code', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBeUndefined();
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Test error', 400);

      expect(error.statusCode).toBe(400);
    });

    it('should create error with custom code', () => {
      const error = new AppError('Test error', 400, 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error with default message', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
    });

    it('should create 404 error with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ValidationError', () => {
    it('should create 400 error with default message', () => {
      const error = new ValidationError();

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation error');
    });

    it('should create 400 error with custom message', () => {
      const error = new ValidationError('Invalid email format');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid email format');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error with default message', () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });

    it('should create 401 error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error with default message', () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Forbidden');
    });

    it('should create 403 error with custom message', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Access denied');
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error with default message', () => {
      const error = new ConflictError();

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Resource conflict');
    });

    it('should create 409 error with custom message', () => {
      const error = new ConflictError('Email already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Email already exists');
    });
  });

  describe('DatabaseConnectionError', () => {
    it('should create 503 error with default message', () => {
      const error = new DatabaseConnectionError();

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(error.message).toBe('Database connection error');
    });

    it('should create 503 error with custom message', () => {
      const error = new DatabaseConnectionError('Connection pool exhausted');

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(error.message).toBe('Connection pool exhausted');
    });

    it('should be instance of AppError', () => {
      const error = new DatabaseConnectionError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(DatabaseConnectionError);
    });
  });

  describe('Error Inheritance and Stack Traces', () => {
    it('should have correct name for each error type', () => {
      expect(new AppError('test').name).toBe('AppError');
      expect(new NotFoundError().name).toBe('NotFoundError');
      expect(new ValidationError().name).toBe('ValidationError');
      expect(new UnauthorizedError().name).toBe('UnauthorizedError');
      expect(new ForbiddenError().name).toBe('ForbiddenError');
      expect(new ConflictError().name).toBe('ConflictError');
      expect(new DatabaseConnectionError().name).toBe('DatabaseConnectionError');
    });

    it('should have stack trace', () => {
      const error = new AppError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
      expect(error.stack).toContain('Test error');
    });

    it('should have stack trace for subclass errors', () => {
      const error = new NotFoundError('User not found');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NotFoundError');
    });

    it('all subclasses should be instanceof AppError', () => {
      const errors = [
        new NotFoundError(),
        new ValidationError(),
        new UnauthorizedError(),
        new ForbiddenError(),
        new ConflictError(),
        new DatabaseConnectionError(),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string message', () => {
      const error = new AppError('');

      expect(error.message).toBe('');
      expect(error.statusCode).toBe(500);
    });

    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new AppError(longMessage);

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });

    it('should handle special characters in message', () => {
      const specialMessage = 'Error: <script>alert("xss")</script> & "quotes" \'single\'';
      const error = new AppError(specialMessage);

      expect(error.message).toBe(specialMessage);
    });

    it('should handle unicode in message', () => {
      const unicodeMessage = 'Error: こんにちは 🚀 émoji';
      const error = new AppError(unicodeMessage);

      expect(error.message).toBe(unicodeMessage);
    });

    it('should preserve statusCode 0', () => {
      const error = new AppError('Test', 0);

      expect(error.statusCode).toBe(0);
    });

    it('should handle negative statusCode', () => {
      const error = new AppError('Test', -1);

      expect(error.statusCode).toBe(-1);
    });

    it('should handle boundary status codes', () => {
      const error400 = new AppError('Client Error', 400);
      const error500 = new AppError('Server Error', 500);
      const error599 = new AppError('Custom Error', 599);

      expect(error400.statusCode).toBe(400);
      expect(error500.statusCode).toBe(500);
      expect(error599.statusCode).toBe(599);
    });
  });
});




