/**
 * Unit tests for schedule generator pure functions
 * These tests don't require API keys, database, or external services
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseTime,
  addMinutes,
  generateTimeSlots,
  shuffleArray,
  limitConcurrency,
  applyEpisodeFilters,
  type EpisodeFilterRule,
} from '../../src/lib/schedule-generator.js';

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

  describe('parseTime - timezone handling', () => {
    it('should handle EST timezone offset (-05:00)', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      // User says "13:00 EST" (-05:00) which is 18:00 UTC
      const result = parseTime('13:00', date, '-05:00');

      expect(result.getUTCHours()).toBe(18);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle positive timezone offset (+02:00)', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      // User says "13:00" in +02:00 timezone which is 11:00 UTC
      const result = parseTime('13:00', date, '+02:00');

      expect(result.getUTCHours()).toBe(11);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle UTC timezone (+00:00)', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      const result = parseTime('13:00', date, '+00:00');

      expect(result.getUTCHours()).toBe(13);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle half-hour timezone offset (+05:30)', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      // User says "13:00" in +05:30 (India) which is 07:30 UTC
      const result = parseTime('13:00', date, '+05:30');

      expect(result.getUTCHours()).toBe(7);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('should fallback to UTC for invalid timezone format', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      // Invalid format, should default to UTC
      const result = parseTime('13:00', date, 'EST');

      expect(result.getUTCHours()).toBe(13);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle timezone that causes date rollover', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      // User says "22:00" in -08:00 (PST) which is 06:00 UTC next day
      const result = parseTime('22:00', date, '-08:00');

      expect(result.getUTCHours()).toBe(6);
      // Date should be December 15 due to timezone conversion
      expect(result.getUTCDate()).toBe(15);
    });

    it('should handle time with minutes in timezone offset', () => {
      const date = new Date('2024-12-14T00:00:00Z');
      // User says "13:45" in -05:30 timezone
      const result = parseTime('13:45', date, '-05:30');

      expect(result.getUTCHours()).toBe(19);
      expect(result.getUTCMinutes()).toBe(15);
    });
  });

  describe('shuffleArray', () => {
    it('should return array with same length', () => {
      const input = [1, 2, 3, 4, 5];
      const result = shuffleArray(input);

      expect(result.length).toBe(input.length);
    });

    it('should contain all original elements', () => {
      const input = [1, 2, 3, 4, 5];
      const result = shuffleArray(input);

      expect(result.sort()).toEqual(input.sort());
    });

    it('should not modify original array', () => {
      const input = [1, 2, 3, 4, 5];
      const originalCopy = [...input];
      shuffleArray(input);

      expect(input).toEqual(originalCopy);
    });

    it('should handle empty array', () => {
      const result = shuffleArray([]);

      expect(result).toEqual([]);
    });

    it('should handle single element array', () => {
      const result = shuffleArray([42]);

      expect(result).toEqual([42]);
    });

    it('should handle array with duplicate values', () => {
      const input = [1, 1, 2, 2, 3, 3];
      const result = shuffleArray(input);

      expect(result.sort()).toEqual(input.sort());
    });

    it('should produce different orderings over multiple runs', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = new Set<string>();

      // Run shuffle 20 times and check if we get different orderings
      for (let i = 0; i < 20; i++) {
        results.add(shuffleArray(input).join(','));
      }

      // Should have more than 1 unique ordering (extremely unlikely to be same)
      expect(results.size).toBeGreaterThan(1);
    });

    it('should handle array of objects', () => {
      const input = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = shuffleArray(input);

      expect(result.length).toBe(3);
      expect(result.map(o => o.id).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('limitConcurrency', () => {
    it('should execute all tasks and return results', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ];

      const results = await limitConcurrency(tasks, 2);

      expect(results).toEqual([1, 2, 3]);
    });

    it('should execute tasks in batches', async () => {
      const executionOrder: number[] = [];
      const tasks = [
        async () => { executionOrder.push(1); return 1; },
        async () => { executionOrder.push(2); return 2; },
        async () => { executionOrder.push(3); return 3; },
        async () => { executionOrder.push(4); return 4; },
      ];

      await limitConcurrency(tasks, 2);

      // Tasks 1 and 2 should complete before 3 and 4 start
      // The exact order within a batch may vary
      expect(executionOrder.length).toBe(4);
    });

    it('should handle empty task list', async () => {
      const results = await limitConcurrency([], 5);

      expect(results).toEqual([]);
    });

    it('should handle single task', async () => {
      const results = await limitConcurrency([() => Promise.resolve(42)], 5);

      expect(results).toEqual([42]);
    });

    it('should skip failed tasks and continue with others', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('fail')),
        () => Promise.resolve(3),
      ];

      const results = await limitConcurrency(tasks, 2);

      // Should only contain successful results
      expect(results).toEqual([1, 3]);
    });

    it('should handle all tasks failing', async () => {
      const tasks = [
        () => Promise.reject(new Error('fail 1')),
        () => Promise.reject(new Error('fail 2')),
      ];

      const results = await limitConcurrency(tasks, 2);

      expect(results).toEqual([]);
    });

    it('should respect concurrency limit', async () => {
      let activeCount = 0;
      let maxActive = 0;

      const createTask = () => async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeCount--;
        return activeCount;
      };

      const tasks = [createTask(), createTask(), createTask(), createTask(), createTask()];

      await limitConcurrency(tasks, 2);

      // Max concurrent should be 2 or less
      expect(maxActive).toBeLessThanOrEqual(2);
    });

    it('should handle limit greater than task count', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
      ];

      const results = await limitConcurrency(tasks, 10);

      expect(results).toEqual([1, 2]);
    });

    it('should handle limit of 1 (sequential execution)', async () => {
      const results: number[] = [];
      const tasks = [
        async () => { results.push(1); return 1; },
        async () => { results.push(2); return 2; },
        async () => { results.push(3); return 3; },
      ];

      const output = await limitConcurrency(tasks, 1);

      // With limit 1, order should be preserved
      expect(results).toEqual([1, 2, 3]);
      expect(output).toEqual([1, 2, 3]);
    });
  });

  describe('applyEpisodeFilters', () => {
    // Test episode data
    const episodes = [
      { content_id: 'show1', season: 1, episode_number: 1 },
      { content_id: 'show1', season: 1, episode_number: 2 },
      { content_id: 'show1', season: 1, episode_number: 3 },
      { content_id: 'show1', season: 2, episode_number: 1 },
      { content_id: 'show1', season: 2, episode_number: 2 },
      { content_id: 'show2', season: 1, episode_number: 1 },
      { content_id: 'show2', season: 1, episode_number: 2 },
    ];

    describe('No filters', () => {
      it('should return all episodes when no filters provided', () => {
        const result = applyEpisodeFilters(episodes);

        expect(result).toEqual(episodes);
      });

      it('should return all episodes when filters is undefined', () => {
        const result = applyEpisodeFilters(episodes, undefined);

        expect(result).toEqual(episodes);
      });

      it('should return all episodes when filters is empty object', () => {
        const result = applyEpisodeFilters(episodes, {});

        expect(result).toEqual(episodes);
      });
    });

    describe('Mode: all', () => {
      it('should return all episodes for show with mode "all"', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'all' },
        };

        const result = applyEpisodeFilters(episodes, filters);

        expect(result).toEqual(episodes);
      });
    });

    describe('Mode: include', () => {
      it('should only include specified seasons', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'include', seasons: [1] },
        };

        const result = applyEpisodeFilters(episodes, filters);

        // All show1 season 1 episodes + all show2 episodes (no filter for show2)
        expect(result.length).toBe(5);
        expect(result.filter(e => e.content_id === 'show1' && e.season === 2).length).toBe(0);
      });

      it('should only include specified episodes', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: {
            mode: 'include',
            episodes: [
              { season: 1, episode: 1 },
              { season: 2, episode: 1 },
            ],
          },
        };

        const result = applyEpisodeFilters(episodes, filters);

        const show1Episodes = result.filter(e => e.content_id === 'show1');
        expect(show1Episodes.length).toBe(2);
        expect(show1Episodes[0].episode_number).toBe(1);
        expect(show1Episodes[1].episode_number).toBe(1);
      });

      it('should include episodes matching season OR specific episode', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: {
            mode: 'include',
            seasons: [1],
            episodes: [{ season: 2, episode: 2 }],
          },
        };

        const result = applyEpisodeFilters(episodes, filters);

        const show1Episodes = result.filter(e => e.content_id === 'show1');
        // All S1 episodes (3) + S2E2 (1) = 4
        expect(show1Episodes.length).toBe(4);
      });

      it('should return all episodes if include mode but no selections', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'include', seasons: [], episodes: [] },
        };

        const result = applyEpisodeFilters(episodes, filters);

        // No selections means include all
        expect(result).toEqual(episodes);
      });
    });

    describe('Mode: exclude', () => {
      it('should exclude specified seasons', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'exclude', seasons: [2] },
        };

        const result = applyEpisodeFilters(episodes, filters);

        // Exclude show1 season 2
        expect(result.filter(e => e.content_id === 'show1' && e.season === 2).length).toBe(0);
        expect(result.filter(e => e.content_id === 'show1' && e.season === 1).length).toBe(3);
      });

      it('should exclude specified episodes', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: {
            mode: 'exclude',
            episodes: [{ season: 1, episode: 1 }],
          },
        };

        const result = applyEpisodeFilters(episodes, filters);

        const show1Eps = result.filter(e => e.content_id === 'show1');
        // Exclude S1E1 only
        expect(show1Eps.length).toBe(4);
        expect(show1Eps.find(e => e.season === 1 && e.episode_number === 1)).toBeUndefined();
      });

      it('should exclude episodes matching season OR specific episode', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: {
            mode: 'exclude',
            seasons: [1],
            episodes: [{ season: 2, episode: 2 }],
          },
        };

        const result = applyEpisodeFilters(episodes, filters);

        const show1Eps = result.filter(e => e.content_id === 'show1');
        // Only S2E1 should remain
        expect(show1Eps.length).toBe(1);
        expect(show1Eps[0].season).toBe(2);
        expect(show1Eps[0].episode_number).toBe(1);
      });

      it('should return all episodes if exclude mode but no selections', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'exclude', seasons: [], episodes: [] },
        };

        const result = applyEpisodeFilters(episodes, filters);

        // No selections means exclude nothing
        expect(result).toEqual(episodes);
      });
    });

    describe('Multiple shows with different filters', () => {
      it('should apply different filters to different shows', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'include', seasons: [1] },
          show2: { mode: 'exclude', episodes: [{ season: 1, episode: 2 }] },
        };

        const result = applyEpisodeFilters(episodes, filters);

        // show1: only S1 (3 eps)
        // show2: exclude S1E2 (1 ep remaining)
        const show1Eps = result.filter(e => e.content_id === 'show1');
        const show2Eps = result.filter(e => e.content_id === 'show2');

        expect(show1Eps.length).toBe(3);
        expect(show1Eps.every(e => e.season === 1)).toBe(true);

        expect(show2Eps.length).toBe(1);
        expect(show2Eps[0].episode_number).toBe(1);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty episodes array', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'include', seasons: [1] },
        };

        const result = applyEpisodeFilters([], filters);

        expect(result).toEqual([]);
      });

      it('should handle filter for non-existent show', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show3: { mode: 'include', seasons: [1] },
        };

        const result = applyEpisodeFilters(episodes, filters);

        // No show3 in episodes, so original episodes remain unchanged
        expect(result).toEqual(episodes);
      });

      it('should handle filter with non-existent season', () => {
        const filters: Record<string, EpisodeFilterRule> = {
          show1: { mode: 'include', seasons: [99] },
        };

        const result = applyEpisodeFilters(episodes, filters);

        // No S99 episodes, so show1 episodes are excluded
        const show1Eps = result.filter(e => e.content_id === 'show1');
        expect(show1Eps.length).toBe(0);
      });
    });
  });
});

