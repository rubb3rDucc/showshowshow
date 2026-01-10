/**
 * Shared utility functions
 */

import { ValidationError } from './errors.js';

/**
 * Parse an integer from a string with validation
 * Returns the parsed integer or the default value if parsing fails
 */
export function parseIntWithDefault(
  value: string | null | undefined,
  defaultValue: number
): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse pagination parameters from query string
 * Returns validated page and limit with bounds checking
 */
export function parsePaginationParams(
  query: { page?: string; limit?: string },
  options: { maxLimit?: number; defaultLimit?: number } = {}
): { page: number; limit: number; offset: number } {
  const { maxLimit = 100, defaultLimit = 50 } = options;
  const page = Math.max(1, parseIntWithDefault(query.page, 1));
  const limit = Math.min(maxLimit, Math.max(1, parseIntWithDefault(query.limit, defaultLimit)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Validate that a string is non-empty after trimming
 * Throws ValidationError if empty
 */
export function validateNonEmptyString(
  value: string | null | undefined,
  fieldName: string
): string {
  if (!value || value.trim() === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
  return value.trim();
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Parse a timezone offset string (e.g., "-05:00", "+00:00") to minutes
 * Returns 0 if parsing fails
 */
export function parseTimezoneOffset(offset: string | null | undefined): number {
  if (!offset) return 0;

  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);

  return sign * (hours * 60 + minutes);
}

/**
 * Parse a time string in HH:MM format to hours and minutes
 * Throws ValidationError if format is invalid
 */
export function parseTimeString(
  time: string,
  fieldName: string = 'time'
): { hours: number; minutes: number } {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new ValidationError(`Invalid ${fieldName} format. Expected HH:MM`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new ValidationError(`Invalid ${fieldName}. Hours must be 0-23, minutes must be 0-59`);
  }

  return { hours, minutes };
}

/**
 * Parse a date string in YYYY-MM-DD format
 * Throws ValidationError if format is invalid
 */
export function parseDateString(
  dateStr: string,
  fieldName: string = 'date'
): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new ValidationError(`Invalid ${fieldName} format. Expected YYYY-MM-DD`);
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ${fieldName}`);
  }

  return date;
}

/**
 * Format a date as YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate elapsed time in a human-readable format
 */
export function formatElapsedTime(startTime: number): string {
  const elapsed = Date.now() - startTime;
  if (elapsed < 1000) {
    return `${elapsed}ms`;
  }
  return `${(elapsed / 1000).toFixed(2)}s`;
}

/**
 * Calculate viewing progress for a content item
 * Used across library routes to avoid duplication
 */
export function calculateProgress(
  totalEpisodes: number | null | undefined,
  episodesWatched: number | null | undefined
): {
  total: number;
  watched: number;
  percentage: number;
} {
  const total = totalEpisodes || 0;
  const watched = episodesWatched || 0;
  const percentage = total > 0 ? Math.round((watched / total) * 100) : 0;

  return { total, watched, percentage };
}
