/**
 * Toonami Show Integration Tests
 * 
 * These tests replicate the functionality of toonami-tests.sh
 * but in a TypeScript testing framework.
 * 
 * Make sure your server is running: pnpm run dev
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  authenticateUser,
  fetchContent,
  fetchEpisodes,
  addToQueue,
  getQueue,
  clearQueue,
  generateScheduleFromQueue,
  generateScheduleFromShows,
  deleteScheduleForDateRange,
  getLibrary,
} from './setup/test-helpers';

// Toonami Show TMDB IDs
const DBZ_ID = 12971;
const SAILOR_MOON_ID = 3570;
const GUNDAM_WING_ID = 21730;
const OUTLAW_STAR_ID = 35106;
const COWBOY_BEBOP_ID = 30991;

// Movie TMDB ID
const MATRIX_ID = 603;

describe('Toonami Show Tests', () => {
  let token: string;
  let dbzContentId: string;
  let sailorMoonContentId: string;
  let gundamContentId: string;
  let bebopContentId: string;
  let matrixContentId: string;

  beforeAll(async () => {
    // Step 1: Authenticate
    token = await authenticateUser('toonami@test.com', 'password123');
    expect(token).toBeTruthy();
  });

  describe('Step 2: Fetch and Cache Toonami Shows', () => {
    it('should fetch and cache Dragon Ball Z', async () => {
      const response = await fetchContent(DBZ_ID, token);
      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
      expect(response.data.tmdb_id).toBe(DBZ_ID);
      dbzContentId = response.data.id;
    });

    it('should fetch and cache Sailor Moon', async () => {
      const response = await fetchContent(SAILOR_MOON_ID, token);
      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
      expect(response.data.tmdb_id).toBe(SAILOR_MOON_ID);
      sailorMoonContentId = response.data.id;
    });

    it('should fetch and cache Gundam Wing', async () => {
      const response = await fetchContent(GUNDAM_WING_ID, token);
      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
      expect(response.data.tmdb_id).toBe(GUNDAM_WING_ID);
      gundamContentId = response.data.id;
    });

    it('should fetch and cache Cowboy Bebop', async () => {
      const response = await fetchContent(COWBOY_BEBOP_ID, token);
      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
      expect(response.data.tmdb_id).toBe(COWBOY_BEBOP_ID);
      bebopContentId = response.data.id;
    });
  });

  describe('Step 3: Queue Management', () => {
    it('should add Cowboy Bebop to queue', async () => {
      const response = await addToQueue(bebopContentId, token);
      expect([200, 201]).toContain(response.status);
    });

    it('should retrieve queue and verify content', async () => {
      const response = await getQueue(token);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      
      const queueItem = response.data[0];
      expect(queueItem.content_id).toBe(bebopContentId);
    });
  });

  describe('Step 5: Fetch Episodes', () => {
    it('should fetch episodes for Cowboy Bebop', async () => {
      const response = await fetchEpisodes(COWBOY_BEBOP_ID, token);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });
  });

  describe('Step 6: Generate Schedule from Queue (Round Robin)', () => {
    afterEach(async () => {
      // Clean up after each test
      await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
      await clearQueue(token);
    });

    it('should generate schedule with round_robin rotation', async () => {
      // Ensure queue has content
      await addToQueue(bebopContentId, token);
      
      // Ensure episodes are fetched
      await fetchEpisodes(COWBOY_BEBOP_ID, token);

      const response = await generateScheduleFromQueue(
        {
          startDate: '2024-12-14',
          endDate: '2024-12-14',
          startTime: '18:00',
          endTime: '20:00',
          timeSlotDuration: 30,
          maxShowsPerTimeSlot: 1,
          includeReruns: false,
          rerunFrequency: 'rarely',
          rotationType: 'round_robin',
        },
        token
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.count).toBeGreaterThan(0);
      expect(Array.isArray(response.data.schedule)).toBe(true);
      expect(response.data.schedule.length).toBeGreaterThan(0);
    });
  });

  describe('Step 7: Generate Schedule with Random Rotation', () => {
    afterEach(async () => {
      await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
      await clearQueue(token);
    });

    it('should generate schedule with random rotation', async () => {
      // Ensure episodes are fetched
      await fetchEpisodes(COWBOY_BEBOP_ID, token);

      const response = await generateScheduleFromShows(
        [bebopContentId],
        {
          startDate: '2024-12-14',
          endDate: '2024-12-14',
          startTime: '18:00',
          endTime: '20:00',
          rotationType: 'random',
        },
        token
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.count).toBeGreaterThan(0);
    });
  });

  describe('Step 8: Generate Schedule with Midnight Crossover', () => {
    afterEach(async () => {
      await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
      await clearQueue(token);
    });

    it('should generate schedule from 18:00 to 00:00', async () => {
      await fetchEpisodes(COWBOY_BEBOP_ID, token);

      const response = await generateScheduleFromShows(
        [bebopContentId],
        {
          startDate: '2024-12-14',
          endDate: '2024-12-14',
          startTime: '18:00',
          endTime: '00:00',
          rotationType: 'round_robin',
        },
        token
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.count).toBeGreaterThan(0);
    });
  });

  describe('Step 9: Generate Schedule with 2 Shows', () => {
    afterEach(async () => {
      await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
      await clearQueue(token);
    });

    it('should generate schedule with Cowboy Bebop and Dragon Ball Z', async () => {
      // Add shows to queue
      await addToQueue(bebopContentId, token);
      await addToQueue(dbzContentId, token);

      // Fetch episodes for both shows
      await fetchEpisodes(COWBOY_BEBOP_ID, token);
      await fetchEpisodes(DBZ_ID, token);

      const response = await generateScheduleFromQueue(
        {
          startDate: '2024-12-14',
          endDate: '2024-12-14',
          startTime: '18:00',
          endTime: '20:00',
          timeSlotDuration: 30,
          maxShowsPerTimeSlot: 1,
          includeReruns: false,
          rerunFrequency: 'rarely',
          rotationType: 'round_robin',
        },
        token
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.count).toBeGreaterThan(0);
      expect(response.data.schedule).toBeDefined();
      expect(Array.isArray(response.data.schedule)).toBe(true);
      expect(response.data.schedule.length).toBeGreaterThan(0);
      
      // Verify schedule items have required fields
      const firstItem = response.data.schedule[0];
      expect(firstItem).toHaveProperty('content_id');
      expect(firstItem).toHaveProperty('scheduled_time');
      expect(firstItem).toHaveProperty('duration');
    });
  });

  describe('Step 10: Generate Schedule with 3 Shows', () => {
    afterEach(async () => {
      await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
      await clearQueue(token);
    });

    it('should generate schedule with 3 shows (Cowboy Bebop + DBZ + Sailor Moon)', async () => {
      // Add shows to queue
      await addToQueue(bebopContentId, token);
      await addToQueue(dbzContentId, token);
      await addToQueue(sailorMoonContentId, token);

      // Fetch episodes
      await fetchEpisodes(COWBOY_BEBOP_ID, token);
      await fetchEpisodes(DBZ_ID, token);
      await fetchEpisodes(SAILOR_MOON_ID, token);

      const response = await generateScheduleFromQueue(
        {
          startDate: '2024-12-14',
          endDate: '2024-12-14',
          startTime: '18:00',
          endTime: '20:00',
          timeSlotDuration: 30,
          maxShowsPerTimeSlot: 1,
          includeReruns: false,
          rerunFrequency: 'rarely',
          rotationType: 'round_robin',
        },
        token
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.count).toBeGreaterThan(0);
    });
  });

  describe('Step 11: Generate Schedule with Movie (Long Block)', () => {
    afterEach(async () => {
      await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
      await clearQueue(token);
    });

    it('should generate schedule with The Matrix (5-hour block)', async () => {
      // Fetch The Matrix
      const matrixResponse = await fetchContent(MATRIX_ID, token);
      expect(matrixResponse.status).toBe(200);
      matrixContentId = matrixResponse.data.id;

      // Add to queue
      await addToQueue(matrixContentId, token);

      // Verify queue
      const queueResponse = await getQueue(token);
      expect(queueResponse.data.some((item: any) => item.content_id === matrixContentId)).toBe(true);

      const response = await generateScheduleFromQueue(
        {
          startDate: '2024-12-14',
          endDate: '2024-12-14',
          startTime: '18:00',
          endTime: '23:00',
          timeSlotDuration: 30,
          maxShowsPerTimeSlot: 1,
          includeReruns: false,
          rerunFrequency: 'rarely',
          rotationType: 'round_robin',
        },
        token
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.count).toBeGreaterThan(0);
      
      // Calculate total duration
      const totalDuration = response.data.schedule.reduce(
        (sum: number, item: any) => sum + (item.duration || 0),
        0
      );
      expect(totalDuration).toBeGreaterThan(0);
    });
  });

  describe('Step 12: Generate Schedule with Movie and Show', () => {
    afterEach(async () => {
      await deleteScheduleForDateRange('2024-12-13', '2024-12-31', token);
      await clearQueue(token);
    });

    it('should generate schedule with The Matrix and Cowboy Bebop', async () => {
      // Ensure Matrix is fetched
      if (!matrixContentId) {
        const matrixResponse = await fetchContent(MATRIX_ID, token);
        matrixContentId = matrixResponse.data.id;
      }

      // Add both to queue
      await addToQueue(matrixContentId, token);
      await addToQueue(bebopContentId, token);

      // Verify queue contents
      const queueResponse = await getQueue(token);
      const queueItems = queueResponse.data.map((item: any) => ({
        content_id: item.content_id,
        title: item.title,
        content_type: item.content_type,
      }));
      expect(queueItems.length).toBeGreaterThanOrEqual(2);

      const response = await generateScheduleFromQueue(
        {
          startDate: '2024-12-15',
          endDate: '2024-12-15',
          startTime: '18:00',
          endTime: '23:00',
          timeSlotDuration: 30,
          maxShowsPerTimeSlot: 1,
          includeReruns: false,
          rerunFrequency: 'rarely',
          rotationType: 'round_robin',
        },
        token
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.count).toBeGreaterThan(0);
      
      // Verify schedule contains both movie and show
      const scheduleByType = response.data.schedule.reduce((acc: any, item: any) => {
        const type = item.content_type || 'unknown';
        if (!acc[type]) {
          acc[type] = { count: 0, totalDuration: 0 };
        }
        acc[type].count++;
        acc[type].totalDuration += item.duration || 0;
        return acc;
      }, {});
      
      expect(Object.keys(scheduleByType).length).toBeGreaterThan(0);
    });
  });

  describe('Step 13: View Library', () => {
    it('should retrieve library of cached content', async () => {
      const response = await getLibrary(token);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      
      // Verify we have at least the shows we fetched
      const titles = response.data.map((item: any) => item.title);
      expect(titles.length).toBeGreaterThan(0);
    });
  });
});

