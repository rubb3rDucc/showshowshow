/**
 * Integration tests for health and basic endpoints
 * Tests the actual HTTP behavior of the API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildMinimalTestApp } from './test-app.js';

describe('Health and Basic Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildMinimalTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('should return valid ISO timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      const date = new Date(body.timestamp);
      expect(date.toISOString()).toBe(body.timestamp);
    });

    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('GET /api/test', () => {
    it('should return test message', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Backend is running!');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/unknown-route',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for wrong HTTP method', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/health',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
