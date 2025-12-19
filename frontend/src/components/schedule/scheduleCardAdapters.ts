import type { ScheduleItem, QueueItem } from '../../types/api'

// Adapter types for the new card component
export interface ScheduleCardItem {
  id: string
  title: string
  startTime: Date
  endTime: Date
}

export interface QueueCardItem {
  posterUrl: string | null
  type: 'movie' | 'show'
  title: string
  rating?: string | null
}

// Helper function to round time to next 15-minute interval
function roundToNext15Minutes(date: Date): Date {
  const rounded = new Date(date)
  const minutes = rounded.getMinutes()
  const remainder = minutes % 15
  
  if (remainder === 0) {
    // Already on a 15-minute interval
    return rounded
  }
  
  // Round up to next 15-minute interval
  const minutesToAdd = 15 - remainder
  rounded.setMinutes(minutes + minutesToAdd)
  rounded.setSeconds(0)
  rounded.setMilliseconds(0)
  
  return rounded
}

// Helper function to convert API ScheduleItem to ScheduleCardItem
export function adaptScheduleItemForCard(item: ScheduleItem): ScheduleCardItem {
  const startTime = new Date(item.scheduled_time)
  const calculatedEndTime = new Date(startTime.getTime() + item.duration * 60 * 1000)
  // Round end time to next 15-minute interval
  const endTime = roundToNext15Minutes(calculatedEndTime)
  
  return {
    id: item.id,
    title: item.title,
    startTime,
    endTime,
  }
}

// Helper function to convert API QueueItem to QueueCardItem (if available)
export function adaptQueueItemForCard(item: QueueItem | null | undefined): QueueCardItem | undefined {
  if (!item) return undefined
  
  return {
    posterUrl: item.poster_url || null,
    type: item.content_type === 'movie' ? 'movie' : 'show',
    title: item.title || '',
    rating: item.content?.rating || null,
  }
}

// Helper function to create QueueCardItem from ScheduleItem (for poster/type info)
export function adaptScheduleItemToQueueCard(item: ScheduleItem): QueueCardItem {
  return {
    posterUrl: item.poster_url || null,
    type: item.content_type === 'movie' ? 'movie' : 'show',
    title: item.title || '',
    rating: item.rating || null,
  }
}

