/**
 * Unit tests for TMDB helper functions
 * These tests don't require API keys or external API calls
 */

import { describe, it, expect } from 'vitest';
import { getImageUrl, getContentType, getDefaultDuration, extractUSRating } from '../../src/lib/tmdb.js';

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

  describe('extractUSRating', () => {
    describe('TV Shows', () => {
      it('should extract US rating from TV content ratings', () => {
        const contentRatings = {
          results: [
            { iso_3166_1: 'GB', rating: '15' },
            { iso_3166_1: 'US', rating: 'TV-MA' },
            { iso_3166_1: 'DE', rating: '16' },
          ],
        };

        const rating = extractUSRating(contentRatings, 'show');

        expect(rating).toBe('TV-MA');
      });

      it('should fallback to first rating when US not available for shows', () => {
        const contentRatings = {
          results: [
            { iso_3166_1: 'GB', rating: '15' },
            { iso_3166_1: 'DE', rating: '16' },
          ],
        };

        const rating = extractUSRating(contentRatings, 'show');

        expect(rating).toBe('15');
      });

      it('should return null for shows with no ratings', () => {
        const contentRatings = { results: [] };

        const rating = extractUSRating(contentRatings, 'show');

        expect(rating).toBeNull();
      });

      it('should return null for shows with null content ratings', () => {
        const rating = extractUSRating(null, 'show');

        expect(rating).toBeNull();
      });

      it('should return null for shows with undefined content ratings', () => {
        const rating = extractUSRating(undefined, 'show');

        expect(rating).toBeNull();
      });

      it('should handle US entry without rating', () => {
        const contentRatings = {
          results: [
            { iso_3166_1: 'US', rating: '' },
            { iso_3166_1: 'GB', rating: 'PG' },
          ],
        };

        const rating = extractUSRating(contentRatings, 'show');

        // US entry found but rating is empty, and fallback only checks first entry's rating
        // Since US has empty rating, result is null (fallback checks first entry which is US with empty)
        expect(rating).toBeNull();
      });

      it('should fallback to first entry with rating when US not found', () => {
        const contentRatings = {
          results: [
            { iso_3166_1: 'GB', rating: 'PG' },
            { iso_3166_1: 'DE', rating: '16' },
          ],
        };

        const rating = extractUSRating(contentRatings, 'show');

        // Fallback to first available rating (GB)
        expect(rating).toBe('PG');
      });
    });

    describe('Movies', () => {
      it('should extract US certification from movie release dates', () => {
        const contentRatings = {
          results: [
            {
              iso_3166_1: 'GB',
              release_dates: [{ certification: '15' }],
            },
            {
              iso_3166_1: 'US',
              release_dates: [
                { certification: 'PG-13', release_date: '2020-01-01' },
                { certification: 'R', release_date: '2020-06-01' },
              ],
            },
          ],
        };

        const rating = extractUSRating(contentRatings, 'movie');

        // Should return the most recent certification (last in array)
        expect(rating).toBe('R');
      });

      it('should fallback to other country when US not available for movies', () => {
        const contentRatings = {
          results: [
            {
              iso_3166_1: 'GB',
              release_dates: [{ certification: '15' }],
            },
            {
              iso_3166_1: 'DE',
              release_dates: [{ certification: '16' }],
            },
          ],
        };

        const rating = extractUSRating(contentRatings, 'movie');

        expect(rating).toBe('15');
      });

      it('should return null for movies with no certifications', () => {
        const contentRatings = {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [],
            },
          ],
        };

        const rating = extractUSRating(contentRatings, 'movie');

        expect(rating).toBeNull();
      });

      it('should return null for movies with null content ratings', () => {
        const rating = extractUSRating(null, 'movie');

        expect(rating).toBeNull();
      });

      it('should skip empty certifications', () => {
        const contentRatings = {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [
                { certification: '' },
                { certification: 'PG-13' },
                { certification: '' },
              ],
            },
          ],
        };

        const rating = extractUSRating(contentRatings, 'movie');

        expect(rating).toBe('PG-13');
      });

      it('should return null when all certifications are empty', () => {
        const contentRatings = {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [
                { certification: '' },
                { certification: '' },
              ],
            },
          ],
        };

        const rating = extractUSRating(contentRatings, 'movie');

        expect(rating).toBeNull();
      });

      it('should handle missing release_dates array', () => {
        const contentRatings = {
          results: [
            { iso_3166_1: 'US' }, // No release_dates
          ],
        };

        const rating = extractUSRating(contentRatings, 'movie');

        expect(rating).toBeNull();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty results array', () => {
        const contentRatings = { results: [] };

        expect(extractUSRating(contentRatings, 'show')).toBeNull();
        expect(extractUSRating(contentRatings, 'movie')).toBeNull();
      });

      it('should handle missing results property', () => {
        const contentRatings = {};

        expect(extractUSRating(contentRatings, 'show')).toBeNull();
        expect(extractUSRating(contentRatings, 'movie')).toBeNull();
      });
    });
  });
});

