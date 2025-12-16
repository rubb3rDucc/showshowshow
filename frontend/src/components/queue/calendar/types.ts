import type { ScheduleItem } from '../../../types/api';

export interface TimeSlot {
  hour: number;
  minute: number;
  display: string;
}

export type SchedulingMode = 'sequential' | 'random';

export interface PendingScheduleItem {
  id: string;
  content_id: string;
  season: number | null;
  episode: number | null;
  scheduled_time: string;
  title: string;
  duration?: number;
}

export interface QueueBuilderCalendarProps {
  expanded?: boolean;
  onToggle?: () => void;
}

export interface BlockPosition {
  top: string;
  height: string;
  startHour: number;
  startMinute: number;
  duration: number;
}

export interface HoveredTime {
  time: Date;
  hour: number;
  minute: number;
  availableDuration: number;
  mouseX: number;
  mouseY: number;
}

export type ScheduleItemWithType = (ScheduleItem | PendingScheduleItem) & {
  type: 'saved' | 'pending';
};

