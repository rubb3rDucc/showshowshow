/**
 * Unit tests for schedule generator pure functions
 * These tests don't require API keys, database, or external services
 */

import { describe, it, expect } from 'vitest';
import { parseTime, addMinutes, generateTimeSlots } from '../../src/lib/schedule-generator.js';

describe('Schedule Generator - Pure Functions', () => {
  describe('parseTime', () => {
    it('should parse time string correctly', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      const result = parseTime('18:30', date);

      expect(result.getUTCHours()).toBe(18);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCDate()).toBe(14);
      expect(result.getUTCMonth()).toBe(11); // December is month 11 (0-indexed)
      expect(result.getUTCFullYear()).toBe(2024);
    });

    it('should handle midnight (00:00)', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      const result = parseTime('00:00', date);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle late night times', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      const result = parseTime('23:59', date);

      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
    });

    it('should preserve date information', () => {
      const date = new Date('2024-12-25T00:00:00Z');
      const result = parseTime('12:00', date);

      expect(result.getUTCDate()).toBe(25);
      expect(result.getUTCMonth()).toBe(11);
      expect(result.getUTCFullYear()).toBe(2024);
    });
  });

  describe('addMinutes', () => {
    it('should add minutes to a date', () => {
      const date = new Date('2024-12-14T18:00:00Z');
      const result = addMinutes(date, 30);

      expect(result.getTime()).toBe(date.getTime() + 30 * 60 * 1000);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('should handle hour overflow', () => {
      const date = new Date('2024-12-14T18:45:00Z');
      const result = addMinutes(date, 30);

      expect(result.getUTCHours()).toBe(19);
      expect(result.getUTCMinutes()).toBe(15);
    });

    it('should handle day overflow', () => {
      const date = new Date('2024-12-14T23:45:00Z');
      const result = addMinutes(date, 30);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(15);
      expect(result.getUTCDate()).toBe(15);
    });

    it('should handle negative minutes (subtraction)', () => {
      const date = new Date('2024-12-14T18:30:00Z');
      const result = addMinutes(date, -30);

      expect(result.getTime()).toBe(date.getTime() - 30 * 60 * 1000);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle large minute values', () => {
      const date = new Date('2024-12-14T18:00:00Z');
      const result = addMinutes(date, 120); // 2 hours

      expect(result.getUTCHours()).toBe(20);
      expect(result.getUTCMinutes()).toBe(0);
    });
  });

  describe('generateTimeSlots', () => {
    it('should generate time slots for same-day range', () => {
      const slots = generateTimeSlots('18:00', '20:00', 30);

      expect(slots).toEqual(['18:00', '18:30', '19:00', '19:30']);
    });

    it('should handle 15-minute slots', () => {
      const slots = generateTimeSlots('18:00', '19:00', 15);

      expect(slots).toEqual(['18:00', '18:15', '18:30', '18:45']);
    });

    it('should handle midnight crossover (18:00 to 00:00)', () => {
      const slots = generateTimeSlots('18:00', '00:00', 30);

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe('18:00');
      expect(slots[slots.length - 1]).toBe('00:00');
      // Should have slots from 18:00 to 00:00 (6 hours = 13 slots including 00:00)
      expect(slots.length).toBe(13);
    });

    it('should handle midnight crossover with different end time', () => {
      const slots = generateTimeSlots('22:00', '01:00', 30);

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe('22:00');
      // The function stops at 00:00 when crossing midnight
      expect(slots[slots.length - 1]).toBe('00:00');
    });

    it('should handle 1-hour slots', () => {
      const slots = generateTimeSlots('18:00', '22:00', 60);

      expect(slots).toEqual(['18:00', '19:00', '20:00', '21:00']);
    });

    it('should handle edge case: same start and end time', () => {
      const slots = generateTimeSlots('18:00', '18:00', 30);

      expect(slots).toEqual([]);
    });

    it('should handle edge case: end before start (crosses midnight)', () => {
      const slots = generateTimeSlots('20:00', '18:00', 30);

      // When end < start, it's treated as midnight crossover
      // So it goes from 20:00 to 00:00 (next day)
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe('20:00');
      expect(slots[slots.length - 1]).toBe('00:00');
    });

    it('should handle 45-minute slots', () => {
      const slots = generateTimeSlots('18:00', '20:00', 45);

      expect(slots).toEqual(['18:00', '18:45', '19:30']);
    });

    it('should handle odd minute values', () => {
      const slots = generateTimeSlots('18:00', '19:00', 20);

      expect(slots).toEqual(['18:00', '18:20', '18:40']);
    });

    it('should format times with leading zeros', () => {
      const slots = generateTimeSlots('09:00', '10:00', 30);

      expect(slots[0]).toBe('09:00');
      expect(slots[1]).toBe('09:30');
    });
  });
});

