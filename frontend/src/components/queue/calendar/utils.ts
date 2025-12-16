import type { TimeSlot, PendingScheduleItem } from './types';
import type { ScheduleItem as ApiScheduleItem } from '../../../types/api';

// Generate time slots (every 15 minutes from 12 AM to 11:45 PM)
export function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = 0; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = new Date();
      time.setHours(hour, minute, 0, 0);
      slots.push({
        hour,
        minute,
        display: time.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      });
    }
  }
  return slots;
}

// Helper to safely convert to Date object
// Handles timezone issues by creating a date at midnight in local timezone
export function toDate(date: Date | null | string | undefined): Date | null {
  if (!date) return null;
  
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return null;
    // For Date objects from date picker, use as-is but ensure it's at midnight local time
    // This prevents timezone shifts when the date picker returns a date
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return localDate;
  }
  
  if (typeof date === 'string') {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    // Create a new date at midnight in local timezone
    const localDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    return localDate;
  }
  
  return null;
}

// Format date as YYYY-MM-DD (using local timezone to avoid date shift)
export function formatDate(date: Date | null | string | undefined): string | undefined {
  const dateObj = toDate(date);
  if (!dateObj) return undefined;
  
  // Use local date methods to avoid timezone conversion issues
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate position and height for timeline blocks
export function getItemPosition(
  item: ApiScheduleItem | PendingScheduleItem
): {
  top: string;
  height: string;
  startHour: number;
  startMinute: number;
  duration: number;
} {
  const startTime = new Date(item.scheduled_time);
  const duration = item.duration || 0;
  
  const startHour = startTime.getHours();
  const startMinute = startTime.getMinutes();
  
    // Timeline configuration - ensure 15-minute increments are proportional
    const pixelsPerHour = 120; // 120px per hour
    const pixelsPerMinute = pixelsPerHour / 60; // 2px per minute (proportional)
    
    // Calculate top position using exact minutes for precise alignment
  const totalMinutesFromMidnight = (startHour * 60) + startMinute;
  const topPixels = totalMinutesFromMidnight * pixelsPerMinute;
  
  // Calculate height in pixels - use proportional sizing with smaller minimum for short durations
  const proportionalHeight = duration * pixelsPerMinute;
  const minHeight = duration <= 15 ? 40 : 60;
  const heightPixels = Math.max(proportionalHeight, minHeight);
  
  return { 
    top: `${topPixels}px`, 
    height: `${heightPixels}px`,
    startHour,
    startMinute,
    duration,
  };
}

// Find the blocking item for a given time range
export function getBlockingItem(
  startTime: Date,
  duration: number,
  schedule: ApiScheduleItem[] | undefined,
  pendingItems: Map<string, PendingScheduleItem>
): { item: ApiScheduleItem | PendingScheduleItem; type: 'saved' | 'pending' } | null {
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
  
  // Check against saved items first
  const blockingSaved = schedule?.find(item => {
    const itemStart = new Date(item.scheduled_time);
    const itemEnd = new Date(itemStart.getTime() + item.duration * 60 * 1000);
    return startTime < itemEnd && endTime > itemStart;
  });
  
  if (blockingSaved) {
    return { item: blockingSaved, type: 'saved' };
  }
  
  // Check against pending items
  const blockingPending = Array.from(pendingItems.values()).find(item => {
    const itemStart = new Date(item.scheduled_time);
    const itemEnd = new Date(itemStart.getTime() + (item.duration || 0) * 60 * 1000);
    return startTime < itemEnd && endTime > itemStart;
  });
  
  if (blockingPending) {
    return { item: blockingPending, type: 'pending' };
  }
  
  return null;
}

// Format error message with blocking item details
export function getOccupiedErrorMessage(
  startTime: Date,
  duration: number,
  schedule: ApiScheduleItem[] | undefined,
  pendingItems: Map<string, PendingScheduleItem>
): string {
  const blocking = getBlockingItem(startTime, duration, schedule, pendingItems);
  
  if (!blocking) {
    return 'This time slot is already occupied. Please remove the existing item first.';
  }
  
  const { item } = blocking;
  const itemStart = new Date(item.scheduled_time);
  const itemEnd = new Date(itemStart.getTime() + (item.duration || 0) * 60 * 1000);
  
  const startTimeStr = itemStart.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const endTimeStr = itemEnd.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  const newItemEnd = new Date(startTime.getTime() + duration * 60 * 1000);
  
  if (startTime >= itemStart && startTime < itemEnd) {
    return `The time slot you're trying to schedule is occupied by '${item.title}' starting at ${startTimeStr}.`;
  } else if (newItemEnd > itemStart && newItemEnd <= itemEnd) {
    return `The time slot you're trying to schedule is occupied by '${item.title}' ending at ${endTimeStr}.`;
  } else {
    return `The time slot you're trying to schedule overlaps with '${item.title}' (${startTimeStr} - ${endTimeStr}).`;
  }
}

// Check if a time range overlaps with existing items
export function isTimeRangeOccupied(
  startTime: Date,
  duration: number,
  schedule: ApiScheduleItem[] | undefined,
  pendingItems: Map<string, PendingScheduleItem>
): boolean {
  return getBlockingItem(startTime, duration, schedule, pendingItems) !== null;
}

// Convert mouse position to time
export function getTimeFromPosition(
  y: number,
  _containerHeight: number,
  selectedDate: Date | null
): { time: Date; hour: number; minute: number } | null {
  if (!selectedDate) return null;
  
  const paddingTop = 12;
  const pixelsPerHour = 120;
  const pixelsPerMinute = pixelsPerHour / 60;
  
  const adjustedY = y - paddingTop;
  const totalMinutesFromMidnight = adjustedY / pixelsPerMinute;
  
  const roundedMinutes = Math.round(totalMinutesFromMidnight / 15) * 15;
  
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  
  if (hours >= 24) return null;
  
  const clickedTime = new Date(selectedDate);
  clickedTime.setHours(hours, minutes, 0, 0);
  
  return { time: clickedTime, hour: hours, minute: minutes };
}

// Calculate available duration from a given time
export function getAvailableDuration(
  startTime: Date,
  schedule: ApiScheduleItem[] | undefined,
  pendingItems: Map<string, PendingScheduleItem>
): number {
  const allItems = [
    ...(schedule || []).map(item => ({ ...item, type: 'saved' as const })),
    ...Array.from(pendingItems.values()).map(item => ({ ...item, type: 'pending' as const })),
  ];

  const nextItem = allItems
    .map(item => ({
      start: new Date(item.scheduled_time),
      end: new Date(new Date(item.scheduled_time).getTime() + (item.duration || 0) * 60 * 1000),
    }))
    .filter(item => item.start > startTime)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  if (!nextItem) {
    // No items after this time, available until end of day
    const endOfDay = new Date(startTime);
    endOfDay.setHours(23, 59, 59, 999);
    return Math.floor((endOfDay.getTime() - startTime.getTime()) / (1000 * 60));
  }

  return Math.floor((nextItem.start.getTime() - startTime.getTime()) / (1000 * 60));
}

