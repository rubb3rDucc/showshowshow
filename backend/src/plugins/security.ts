/**
 * Security headers plugin
 * Configures helmet with security headers for Fastify
 */

import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import { isProduction, isDevelopment } from '../lib/env-detection.js';

export const securityPlugin = async (fastify: FastifyInstance) => {
  // Get frontend URL from environment (for CSP)
  const frontendUrl = process.env.FRONTEND_URL || (isDevelopment() ? 'http://localhost:5173' : undefined);

  // Build CSP directives
  const cspDirectives: Record<string, string[]> = {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles (common in React)
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:', 'http:'], // Allow images from anywhere (for TMDB posters)
    fontSrc: ["'self'", 'data:'],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  };

  // Add frontend URL to connectSrc
  const connectSrc = ["'self'"];
  if (frontendUrl) {
    connectSrc.push(frontendUrl);
  }
  if (isDevelopment()) {
    connectSrc.push('http://localhost:*', 'https://localhost:*');
  }
  cspDirectives.connectSrc = connectSrc;

  // Add upgradeInsecureRequests in production
  if (isProduction()) {
    cspDirectives.upgradeInsecureRequests = [];
  }

  // Base security configuration (using helmet's API)
  const helmetConfig = {
    // XSS Protection (deprecated but still works)
    xssFilter: true,
    // Prevent MIME type sniffing
    noSniff: true,
    // Hide X-Powered-By header
    hidePoweredBy: true,

    // Frame Options (prevent clickjacking)
    frameguard: {
      action: 'deny' as const,
    },

    // HSTS (HTTP Strict Transport Security) - only in production
    hsts: isProduction()
      ? {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        }
      : false,

    // Content Security Policy
    contentSecurityPolicy: {
      directives: cspDirectives,
    },

    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin' as const,
    },

    // Permissions Policy (formerly Feature Policy)
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        microphone: ["'none'"],
        camera: ["'none'"],
      },
    },
  };

  await fastify.register(helmet, helmetConfig);
};



