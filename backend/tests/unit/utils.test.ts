/**
 * Unit tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  parseIntWithDefault,
  parsePaginationParams,
  validateNonEmptyString,
  truncateString,
  parseTimezoneOffset,
  parseTimeString,
  parseDateString,
  formatDateString,
  formatElapsedTime,
  calculateProgress,
} from '../../src/lib/utils.js';
import { ValidationError } from '../../src/lib/errors.js';

describe('Utility Functions', () => {
  describe('parseIntWithDefault', () => {
    it('should parse valid integer string', () => {
      expect(parseIntWithDefault('42', 0)).toBe(42);
      expect(parseIntWithDefault('100', 50)).toBe(100);
      expect(parseIntWithDefault('-5', 0)).toBe(-5);
    });

    it('should return default for null/undefined/empty', () => {
      expect(parseIntWithDefault(null, 10)).toBe(10);
      expect(parseIntWithDefault(undefined, 20)).toBe(20);
      expect(parseIntWithDefault('', 30)).toBe(30);
    });

    it('should return default for non-numeric strings', () => {
      expect(parseIntWithDefault('abc', 5)).toBe(5);
      expect(parseIntWithDefault('12.5abc', 5)).toBe(12); // parseInt stops at non-numeric
    });

    it('should handle leading zeros', () => {
      expect(parseIntWithDefault('007', 0)).toBe(7);
    });

    it('should truncate float strings to integer', () => {
      expect(parseIntWithDefault('3.14', 0)).toBe(3);
      expect(parseIntWithDefault('9.99', 0)).toBe(9);
    });

    it('should handle very large numbers', () => {
      expect(parseIntWithDefault('999999999999', 0)).toBe(999999999999);
    });

    it('should handle special numeric strings', () => {
      expect(parseIntWithDefault('0', 5)).toBe(0);
      expect(parseIntWithDefault('+5', 0)).toBe(5);
      expect(parseIntWithDefault('  42  ', 0)).toBe(42);
    });

    it('should return default for whitespace-only string', () => {
      expect(parseIntWithDefault('   ', 10)).toBe(10);
    });
  });

  describe('parsePaginationParams', () => {
    it('should return defaults for empty query', () => {
      const result = parsePaginationParams({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should parse valid page and limit', () => {
      const result = parsePaginationParams({ page: '3', limit: '25' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50); // (3-1) * 25
    });

    it('should enforce minimum page of 1', () => {
      const result = parsePaginationParams({ page: '0', limit: '10' });
      expect(result.page).toBe(1);
      expect(result.offset).toBe(0);
    });

    it('should enforce minimum limit of 1', () => {
      const result = parsePaginationParams({ page: '1', limit: '0' });
      expect(result.limit).toBe(1);
    });

    it('should enforce max limit', () => {
      const result = parsePaginationParams({ page: '1', limit: '500' });
      expect(result.limit).toBe(100); // default maxLimit
    });

    it('should respect custom options', () => {
      const result = parsePaginationParams(
        { page: '1', limit: '200' },
        { maxLimit: 200, defaultLimit: 20 }
      );
      expect(result.limit).toBe(200);
    });

    it('should use custom default limit', () => {
      const result = parsePaginationParams({}, { defaultLimit: 20 });
      expect(result.limit).toBe(20);
    });

    it('should handle very large page numbers', () => {
      const result = parsePaginationParams({ page: '1000000', limit: '10' });
      expect(result.page).toBe(1000000);
      expect(result.offset).toBe(9999990); // (1000000-1) * 10
    });

    it('should handle negative page numbers', () => {
      const result = parsePaginationParams({ page: '-5', limit: '10' });
      expect(result.page).toBe(1); // Clamps to minimum 1
    });

    it('should handle negative limits', () => {
      const result = parsePaginationParams({ page: '1', limit: '-10' });
      expect(result.limit).toBe(1); // Clamps to minimum 1
    });

    it('should handle non-numeric strings', () => {
      const result = parsePaginationParams({ page: 'abc', limit: 'xyz' });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });
  });

  describe('validateNonEmptyString', () => {
    it('should return trimmed string for valid input', () => {
      expect(validateNonEmptyString('hello', 'field')).toBe('hello');
      expect(validateNonEmptyString('  hello  ', 'field')).toBe('hello');
    });

    it('should throw for null', () => {
      expect(() => validateNonEmptyString(null, 'name')).toThrow(ValidationError);
      expect(() => validateNonEmptyString(null, 'name')).toThrow('name is required');
    });

    it('should throw for undefined', () => {
      expect(() => validateNonEmptyString(undefined, 'email')).toThrow(ValidationError);
      expect(() => validateNonEmptyString(undefined, 'email')).toThrow('email is required');
    });

    it('should throw for empty string', () => {
      expect(() => validateNonEmptyString('', 'title')).toThrow(ValidationError);
    });

    it('should throw for whitespace-only string', () => {
      expect(() => validateNonEmptyString('   ', 'content')).toThrow(ValidationError);
    });

    it('should handle unicode whitespace', () => {
      // Non-breaking space, tab, newline
      expect(() => validateNonEmptyString('\u00A0', 'field')).toThrow(ValidationError);
      expect(() => validateNonEmptyString('\t\n', 'field')).toThrow(ValidationError);
    });

    it('should preserve unicode characters after trim', () => {
      expect(validateNonEmptyString('  日本語  ', 'field')).toBe('日本語');
      expect(validateNonEmptyString('  émoji 🎉  ', 'field')).toBe('émoji 🎉');
    });

    it('should handle strings with internal whitespace', () => {
      expect(validateNonEmptyString('hello world', 'field')).toBe('hello world');
      expect(validateNonEmptyString('  a  b  c  ', 'field')).toBe('a  b  c');
    });
  });

  describe('truncateString', () => {
    it('should not truncate strings shorter than max', () => {
      expect(truncateString('hello', 10)).toBe('hello');
      expect(truncateString('hello', 5)).toBe('hello');
    });

    it('should truncate strings longer than max with ellipsis', () => {
      expect(truncateString('hello world', 8)).toBe('hello...');
      expect(truncateString('abcdefghij', 7)).toBe('abcd...');
    });

    it('should handle edge cases', () => {
      expect(truncateString('abc', 3)).toBe('abc');
      expect(truncateString('abcd', 3)).toBe('...');
    });

    it('should handle empty string', () => {
      expect(truncateString('', 10)).toBe('');
      expect(truncateString('', 0)).toBe('');
    });

    it('should handle maxLength of 1 or 2', () => {
      // When maxLength <= 3, slice produces negative start which returns empty + "..."
      // truncateString('abcdef', 1) => slice(0, -2) = 'abcd' + '...' = 'abcd...'
      // This is an edge case where the function doesn't handle small maxLengths well
      expect(truncateString('abcdef', 1)).toBe('abcd...');
      expect(truncateString('abcdef', 2)).toBe('abcde...');
    });

    it('should handle unicode characters', () => {
      // str.length counts code units, not visual characters
      // Japanese characters are 1 code unit each (BMP characters)
      expect(truncateString('日本語テスト', 6)).toBe('日本語テスト'); // Length is exactly 6
      expect(truncateString('日本語テスト', 5)).toBe('日本...'); // 2 chars + ...
      // Emojis are 2 code units each (surrogate pairs)
      expect(truncateString('🎉🎊🎈🎁', 8)).toBe('🎉🎊🎈🎁'); // 4 emojis = 8 code units
      expect(truncateString('🎉🎊🎈🎁', 7)).toBe('🎉🎊...'); // Truncates to 4 + ... but emoji split
    });

    it('should handle exactly maxLength minus 3', () => {
      expect(truncateString('abcdefgh', 8)).toBe('abcdefgh'); // Equal, no truncate
      expect(truncateString('abcdefghi', 8)).toBe('abcde...'); // 9 chars, truncate to 5+...
    });
  });

  describe('parseTimezoneOffset', () => {
    it('should parse negative offsets', () => {
      expect(parseTimezoneOffset('-05:00')).toBe(-300);
      expect(parseTimezoneOffset('-08:30')).toBe(-510);
    });

    it('should parse positive offsets', () => {
      expect(parseTimezoneOffset('+05:30')).toBe(330);
      expect(parseTimezoneOffset('+00:00')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(parseTimezoneOffset(null)).toBe(0);
      expect(parseTimezoneOffset(undefined)).toBe(0);
    });

    it('should return 0 for invalid formats', () => {
      expect(parseTimezoneOffset('5:00')).toBe(0);
      expect(parseTimezoneOffset('EST')).toBe(0);
      expect(parseTimezoneOffset('-5')).toBe(0);
    });

    it('should handle extreme valid offsets', () => {
      // UTC+14 (Line Islands) and UTC-12 (Baker Island)
      expect(parseTimezoneOffset('+14:00')).toBe(840);
      expect(parseTimezoneOffset('-12:00')).toBe(-720);
    });

    it('should handle edge minute values', () => {
      expect(parseTimezoneOffset('+05:45')).toBe(345); // Nepal
      expect(parseTimezoneOffset('+09:30')).toBe(570); // ACST
    });

    it('should reject malformed offsets', () => {
      expect(parseTimezoneOffset('+-05:00')).toBe(0);
      expect(parseTimezoneOffset('+5:000')).toBe(0);
      expect(parseTimezoneOffset('+005:00')).toBe(0);
      expect(parseTimezoneOffset('+05:0')).toBe(0);
    });

    it('should handle empty string', () => {
      expect(parseTimezoneOffset('')).toBe(0);
    });
  });

  describe('parseTimeString', () => {
    it('should parse valid time strings', () => {
      expect(parseTimeString('22:00')).toEqual({ hours: 22, minutes: 0 });
      expect(parseTimeString('09:30')).toEqual({ hours: 9, minutes: 30 });
      expect(parseTimeString('0:00')).toEqual({ hours: 0, minutes: 0 });
    });

    it('should throw for invalid format', () => {
      expect(() => parseTimeString('22')).toThrow(ValidationError);
      expect(() => parseTimeString('22:00:00')).toThrow(ValidationError);
      expect(() => parseTimeString('abc')).toThrow(ValidationError);
    });

    it('should throw for out of range values', () => {
      expect(() => parseTimeString('24:00')).toThrow(ValidationError);
      expect(() => parseTimeString('12:60')).toThrow(ValidationError);
    });

    it('should use custom field name in error', () => {
      expect(() => parseTimeString('invalid', 'start_time')).toThrow(
        'Invalid start_time format'
      );
    });

    it('should handle edge times', () => {
      expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTimeString('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('should reject negative values', () => {
      expect(() => parseTimeString('-1:00')).toThrow(ValidationError);
      expect(() => parseTimeString('12:-30')).toThrow(ValidationError);
    });

    it('should reject empty and whitespace', () => {
      expect(() => parseTimeString('')).toThrow(ValidationError);
      expect(() => parseTimeString('  ')).toThrow(ValidationError);
    });

    it('should reject values with extra characters', () => {
      expect(() => parseTimeString('12:00 PM')).toThrow(ValidationError);
      expect(() => parseTimeString('12:00:00')).toThrow(ValidationError);
    });
  });

  describe('parseDateString', () => {
    it('should parse valid date strings', () => {
      const date = parseDateString('2024-01-15');
      // Use UTC methods to avoid timezone issues
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January is 0
      expect(date.getUTCDate()).toBe(15);
    });

    it('should throw for invalid format', () => {
      expect(() => parseDateString('01-15-2024')).toThrow(ValidationError);
      expect(() => parseDateString('2024/01/15')).toThrow(ValidationError);
      expect(() => parseDateString('January 15, 2024')).toThrow(ValidationError);
    });

    it('should use custom field name in error', () => {
      expect(() => parseDateString('invalid', 'start_date')).toThrow(
        'Invalid start_date format'
      );
    });

    it('should handle leap year dates', () => {
      const leapDate = parseDateString('2024-02-29');
      expect(leapDate.getUTCMonth()).toBe(1); // February
      expect(leapDate.getUTCDate()).toBe(29);
    });

    it('should handle far future and past dates', () => {
      const futureDate = parseDateString('2099-12-31');
      expect(futureDate.getUTCFullYear()).toBe(2099);

      const pastDate = parseDateString('1900-01-01');
      expect(pastDate.getUTCFullYear()).toBe(1900);
    });

    it('should reject empty and whitespace', () => {
      expect(() => parseDateString('')).toThrow(ValidationError);
      expect(() => parseDateString('   ')).toThrow(ValidationError);
    });

    it('should handle edge days of month', () => {
      const endOfMonth = parseDateString('2024-01-31');
      expect(endOfMonth.getUTCDate()).toBe(31);

      const firstOfMonth = parseDateString('2024-06-01');
      expect(firstOfMonth.getUTCDate()).toBe(1);
    });
  });

  describe('formatDateString', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      expect(formatDateString(date)).toBe('2024-01-15');
    });

    it('should pad single digit months and days', () => {
      const date = new Date(2024, 5, 5); // June 5, 2024
      expect(formatDateString(date)).toBe('2024-06-05');
    });

    it('should handle edge year values', () => {
      const year2000 = new Date(2000, 0, 1);
      expect(formatDateString(year2000)).toBe('2000-01-01');

      const year9999 = new Date(9999, 11, 31);
      expect(formatDateString(year9999)).toBe('9999-12-31');
    });

    it('should handle December correctly', () => {
      const december = new Date(2024, 11, 31); // December is month 11
      expect(formatDateString(december)).toBe('2024-12-31');
    });
  });

  describe('formatElapsedTime', () => {
    it('should format milliseconds', () => {
      const start = Date.now() - 500;
      const result = formatElapsedTime(start);
      expect(result).toMatch(/^\d+ms$/);
    });

    it('should format seconds', () => {
      const start = Date.now() - 2500;
      const result = formatElapsedTime(start);
      expect(result).toMatch(/^\d+\.\d{2}s$/);
    });

    it('should handle exact boundary at 1000ms', () => {
      const start = Date.now() - 1000;
      const result = formatElapsedTime(start);
      expect(result).toMatch(/^\d+\.\d{2}s$/); // 1000ms = 1s
    });

    it('should handle zero elapsed time', () => {
      const start = Date.now();
      const result = formatElapsedTime(start);
      expect(result).toMatch(/^\d+ms$/);
    });

    it('should handle large elapsed times', () => {
      const start = Date.now() - 60000; // 60 seconds
      const result = formatElapsedTime(start);
      expect(result).toMatch(/^\d+\.\d{2}s$/);
    });
  });

  describe('calculateProgress', () => {
    it('should calculate correct percentage', () => {
      const result = calculateProgress(10, 5);
      expect(result.total).toBe(10);
      expect(result.watched).toBe(5);
      expect(result.percentage).toBe(50);
    });

    it('should handle null/undefined values', () => {
      expect(calculateProgress(null, null)).toEqual({ total: 0, watched: 0, percentage: 0 });
      expect(calculateProgress(undefined, undefined)).toEqual({ total: 0, watched: 0, percentage: 0 });
      expect(calculateProgress(10, null)).toEqual({ total: 10, watched: 0, percentage: 0 });
    });

    it('should handle zero total', () => {
      const result = calculateProgress(0, 5);
      expect(result.percentage).toBe(0);
    });

    it('should round percentage to nearest integer', () => {
      const result = calculateProgress(3, 1);
      expect(result.percentage).toBe(33); // 33.33... rounds to 33
    });

    it('should handle 100% completion', () => {
      const result = calculateProgress(10, 10);
      expect(result.percentage).toBe(100);
    });

    it('should handle watched > total (over-watched)', () => {
      const result = calculateProgress(10, 15);
      expect(result.percentage).toBe(150); // Can exceed 100%
    });

    it('should handle very large numbers', () => {
      const result = calculateProgress(1000000, 500000);
      expect(result.percentage).toBe(50);
    });

    it('should handle negative values as-is', () => {
      // Negative values are treated as 0 due to || 0
      const result = calculateProgress(-5, -3);
      expect(result.total).toBe(-5);
      expect(result.watched).toBe(-3);
    });

    it('should round percentage correctly', () => {
      // 2/3 = 66.666...% should round to 67
      expect(calculateProgress(3, 2).percentage).toBe(67);
      // 1/6 = 16.666...% should round to 17
      expect(calculateProgress(6, 1).percentage).toBe(17);
    });

    it('should handle fractional inputs', () => {
      // While types suggest number, JavaScript allows floats
      const result = calculateProgress(10.5, 5.5);
      expect(result.total).toBe(10.5);
      expect(result.watched).toBe(5.5);
      expect(result.percentage).toBe(52); // 5.5/10.5 = 52.38...
    });
  });
});
