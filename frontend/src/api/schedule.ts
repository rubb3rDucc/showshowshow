import { apiCall } from './client';
import type { ScheduleItem, GenerateScheduleRequest } from '../types/api';

/**
 * Get user's schedule
 * @param date - Optional date to filter by (YYYY-MM-DD)
 */
export async function getSchedule(date?: string): Promise<ScheduleItem[]> {
  if (date) {
    // Get user's timezone offset (e.g., "-05:00" for EST)
    const offset = new Date().getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const offsetSign = offset <= 0 ? '+' : '-'; // Note: getTimezoneOffset returns negative for ahead of UTC
    const timezoneOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
    
    return apiCall<ScheduleItem[]>(`/api/schedule/date/${date}?timezone_offset=${encodeURIComponent(timezoneOffset)}`);
  }
  return apiCall<ScheduleItem[]>('/api/schedule');
}

/**
 * Generate schedule from queue
 */
export async function generateScheduleFromQueue(
  params: GenerateScheduleRequest
): Promise<{ 
  schedule: ScheduleItem[]; 
  message: string;
  skippedItems?: Array<{
    content_id: string;
    content_title?: string;
    season: number | null;
    episode: number | null;
    attempted_time: string;
    duration: number;
    reason: 'conflict';
    conflicting_item?: {
      start: string;
      end: string;
    };
  }>;
  metadata?: {
    totalAttempted: number;
    scheduled: number;
    skipped: number;
    skippedDueToConflicts: number;
  };
}> {
  return apiCall<{ 
    schedule: ScheduleItem[]; 
    message: string;
    skippedItems?: Array<{
      content_id: string;
      content_title?: string;
      season: number | null;
      episode: number | null;
      attempted_time: string;
      duration: number;
      reason: 'conflict';
      conflicting_item?: {
        start: string;
        end: string;
      };
    }>;
    metadata?: {
      totalAttempted: number;
      scheduled: number;
      skipped: number;
      skippedDueToConflicts: number;
    };
  }>('/api/schedule/generate/queue', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Mark schedule item as watched
 */
export async function markAsWatched(scheduleItemId: string): Promise<void> {
  return apiCall<void>(`/api/schedule/${scheduleItemId}/watched`, {
    method: 'POST',
  });
}

/**
 * Create a schedule item manually
 */
export async function createScheduleItem(params: {
  content_id: string;
  season?: number;
  episode?: number;
  scheduled_time: string;
  duration?: number;
}): Promise<ScheduleItem> {
  return apiCall<ScheduleItem>('/api/schedule', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Delete schedule item
 */
export async function deleteScheduleItem(scheduleItemId: string): Promise<void> {
  return apiCall<void>(`/api/schedule/${scheduleItemId}`, {
    method: 'DELETE',
  });
}

/**
 * Clear all schedule items
 */
export async function clearSchedule(): Promise<{ success: boolean; message: string }> {
  return apiCall<{ success: boolean; message: string }>('/api/schedule', {
    method: 'DELETE',
  });
}

/**
 * Clear schedule items for a specific date
 * @param date - Date to clear (YYYY-MM-DD)
 */
export async function clearScheduleForDate(date: string): Promise<{ success: boolean; message: string }> {
  // Get user's timezone offset (e.g., "-05:00" for EST)
  const offset = new Date().getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset <= 0 ? '+' : '-'; // Note: getTimezoneOffset returns negative for ahead of UTC
  const timezoneOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  
  return apiCall<{ success: boolean; message: string }>(`/api/schedule/date/${date}?timezone_offset=${encodeURIComponent(timezoneOffset)}`, {
    method: 'DELETE',
  });
}

