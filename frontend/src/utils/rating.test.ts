import { describe, it, expect } from 'vitest';
import { normalizeRating } from './rating';

describe('normalizeRating', () => {
  it('returns null for empty/nullish input', () => {
    expect(normalizeRating(null)).toBeNull();
    expect(normalizeRating(undefined)).toBeNull();
    expect(normalizeRating('')).toBeNull();
    expect(normalizeRating('   ')).toBeNull();
  });

  it('keeps full codes intact (regression: PG-13 must not truncate to PG)', () => {
    expect(normalizeRating('PG-13')).toBe('PG-13');
    expect(normalizeRating('PG-13 – TEENS 13 OR OLDER')).toBe('PG-13');
    expect(normalizeRating('NC-17')).toBe('NC-17');
  });

  it('parses common codes at the start of the string', () => {
    expect(normalizeRating('R – 17+ (VIOLENCE & PROFANITY)')).toBe('R');
    expect(normalizeRating('PG')).toBe('PG');
    expect(normalizeRating('G')).toBe('G');
  });

  it('preserves the TV- prefix', () => {
    expect(normalizeRating('TV-14')).toBe('TV-14');
    expect(normalizeRating('TV-MA')).toBe('TV-MA');
    expect(normalizeRating('TV-Y7')).toBe('TV-Y7');
    expect(normalizeRating('TV-Y')).toBe('TV-Y');
  });

  it('uppercases and trims', () => {
    expect(normalizeRating('  tv-ma  ')).toBe('TV-MA');
    expect(normalizeRating('pg-13')).toBe('PG-13');
  });

  it('returns null when no rating token is present', () => {
    expect(normalizeRating('???')).toBeNull();
    expect(normalizeRating('TBA')).toBeNull();
  });
});
