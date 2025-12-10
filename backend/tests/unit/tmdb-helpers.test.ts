/**
 * Unit tests for TMDB helper functions
 * These tests don't require API keys or external API calls
 */

import { describe, it, expect } from 'vitest';
import { getImageUrl, getContentType, getDefaultDuration } from '../../src/lib/tmdb.js';

describe('TMDB Helpers', () => {
  describe('getImageUrl', () => {
    it('should generate image URL with default size', () => {
      const path = '/test-image.jpg';
      const url = getImageUrl(path);

      expect(url).toBe('https://image.tmdb.org/t/p/w500/test-image.jpg');
    });

    it('should generate image URL with custom size', () => {
      const path = '/test-image.jpg';
      const url = getImageUrl(path, 'w780');

      expect(url).toBe('https://image.tmdb.org/t/p/w780/test-image.jpg');
    });

    it('should return null for null path', () => {
      const url = getImageUrl(null);

      expect(url).toBeNull();
    });

    it('should return null for empty path', () => {
      const url = getImageUrl('');

      expect(url).toBeNull();
    });

    it('should handle different image sizes', () => {
      const path = '/poster.jpg';
      const sizes = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];

      sizes.forEach((size) => {
        const url = getImageUrl(path, size);
        expect(url).toBe(`https://image.tmdb.org/t/p/${size}/poster.jpg`);
      });
    });
  });

  describe('getContentType', () => {
    it('should return "show" for TV media type', () => {
      const result = { media_type: 'tv' };
      const type = getContentType(result);

      expect(type).toBe('show');
    });

    it('should return "movie" for movie media type', () => {
      const result = { media_type: 'movie' };
      const type = getContentType(result);

      expect(type).toBe('movie');
    });

    it('should return "movie" for person media type (default)', () => {
      const result = { media_type: 'person' };
      const type = getContentType(result);

      expect(type).toBe('movie'); // Default fallback
    });

    it('should return "movie" for unknown media type', () => {
      const result = { media_type: 'unknown' };
      const type = getContentType(result);

      expect(type).toBe('movie');
    });
  });

  describe('getDefaultDuration', () => {
    it('should return runtime for movies', () => {
      const movie = { runtime: 120 };
      const duration = getDefaultDuration(movie, 'movie');

      expect(duration).toBe(120);
    });

    it('should return default 120 minutes for movies without runtime', () => {
      const movie = {};
      const duration = getDefaultDuration(movie, 'movie');

      expect(duration).toBe(120);
    });

    it('should return first episode runtime for shows', () => {
      const show = { episode_run_time: [22, 24, 23] };
      const duration = getDefaultDuration(show, 'show');

      expect(duration).toBe(22);
    });

    it('should return default 22 minutes for shows without episode_run_time', () => {
      const show = {};
      const duration = getDefaultDuration(show, 'show');

      expect(duration).toBe(22);
    });

    it('should return default 22 minutes for shows with empty episode_run_time', () => {
      const show = { episode_run_time: [] };
      const duration = getDefaultDuration(show, 'show');

      expect(duration).toBe(22);
    });

    it('should return default for zero runtime movies', () => {
      const movie = { runtime: 0 };
      const duration = getDefaultDuration(movie, 'movie');

      // Function returns default 120 when runtime is falsy (0 is falsy)
      expect(duration).toBe(120);
    });
  });
});

