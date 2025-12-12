import { apiCall } from './client';
import type { ScheduleItem, GenerateScheduleRequest } from '../types/api';

/**
 * Get user's schedule
 * @param date - Optional date to filter by (YYYY-MM-DD)
 */
export async function getSchedule(date?: string): Promise<ScheduleItem[]> {
  const endpoint = date ? `/api/schedule/date/${date}` : '/api/schedule';
  return apiCall<ScheduleItem[]>(endpoint);
}

/**
 * Generate schedule from queue
 */
export async function generateScheduleFromQueue(
  params: GenerateScheduleRequest
): Promise<{ schedule: ScheduleItem[]; message: string }> {
  return apiCall<{ schedule: ScheduleItem[]; message: string }>('/api/schedule/generate/queue', {
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
 * Delete schedule item
 */
export async function deleteScheduleItem(scheduleItemId: string): Promise<void> {
  return apiCall<void>(`/api/schedule/${scheduleItemId}`, {
    method: 'DELETE',
  });
}

