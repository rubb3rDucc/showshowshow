import { describe, it, expect } from 'vitest';
import {
  getItemPosition,
  getTimeFromPosition,
  formatDate,
  toDate,
  isTimeRangeOccupied,
  getBlockingItem,
  getAvailableDuration,
} from './utils';
import type { ScheduleItem } from '../../../types/api';
import type { PendingScheduleItem } from './types';

// Local-time strings (no trailing Z) parse as local time, so getHours()/getMinutes()
// are deterministic regardless of the machine timezone running the test.
function sched(scheduled_time: string, duration: number): ScheduleItem {
  return { id: scheduled_time, scheduled_time, duration, title: 'X' } as unknown as ScheduleItem;
}
const noPending = new Map<string, PendingScheduleItem>();

describe('getItemPosition', () => {
  it('places an item by minutes-from-midnight (2px/min, +nothing)', () => {
    const pos = getItemPosition(sched('2026-01-01T06:30:00', 60));
    expect(pos.startHour).toBe(6);
    expect(pos.startMinute).toBe(30);
    expect(pos.top).toBe('780px'); // (6*60+30) * 2
    expect(pos.height).toBe('120px'); // 60min * 2 = 120 > min 60
  });

  it('applies a minimum height for short/zero durations', () => {
    expect(getItemPosition(sched('2026-01-01T00:00:00', 0)).top).toBe('0px');
    expect(getItemPosition(sched('2026-01-01T00:00:00', 0)).height).toBe('40px');
    expect(getItemPosition(sched('2026-01-01T00:00:00', 15)).height).toBe('40px');
  });
});

describe('getTimeFromPosition', () => {
  const day = new Date(2026, 0, 1);

  it('returns null without a selected date', () => {
    expect(getTimeFromPosition(732, 1000, null)).toBeNull();
  });

  it('converts a y offset to an hour/minute (snapped to 15)', () => {
    expect(getTimeFromPosition(732, 1000, day)).toMatchObject({ hour: 6, minute: 0 });
    expect(getTimeFromPosition(792, 1000, day)).toMatchObject({ hour: 6, minute: 30 });
    // 740 -> 370min -> snaps to 375 -> 06:15
    expect(getTimeFromPosition(752, 1000, day)).toMatchObject({ hour: 6, minute: 15 });
  });

  it('returns null past the end of the day', () => {
    expect(getTimeFromPosition(2892, 1000, day)).toBeNull(); // 24:00
  });
});

describe('formatDate / toDate', () => {
  it('formats a Date as local YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDate(new Date(2026, 2, 15))).toBe('2026-03-15');
  });

  it('returns undefined/null for empty input', () => {
    expect(formatDate(null)).toBeUndefined();
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });

  it('returns null for an invalid date string', () => {
    expect(toDate('not-a-date')).toBeNull();
  });

  it('normalizes a Date to local midnight', () => {
    const d = toDate(new Date(2026, 2, 15, 23, 45));
    expect(d).not.toBeNull();
    expect(formatDate(d)).toBe('2026-03-15');
  });
});

describe('overlap detection', () => {
  const schedule = [sched('2026-01-01T06:00:00', 60)]; // 06:00–07:00

  it('detects an overlapping range', () => {
    expect(
      isTimeRangeOccupied(new Date('2026-01-01T06:30:00'), 30, schedule, noPending)
    ).toBe(true);
  });

  it('allows a non-overlapping range', () => {
    expect(
      isTimeRangeOccupied(new Date('2026-01-01T08:00:00'), 30, schedule, noPending)
    ).toBe(false);
  });

  it('returns the blocking item, or null when free', () => {
    expect(getBlockingItem(new Date('2026-01-01T06:30:00'), 30, schedule, noPending)?.type).toBe(
      'saved'
    );
    expect(getBlockingItem(new Date('2026-01-01T08:00:00'), 30, schedule, noPending)).toBeNull();
  });
});

describe('getAvailableDuration', () => {
  it('measures minutes until the next item', () => {
    const schedule = [sched('2026-01-01T08:00:00', 30)];
    expect(
      getAvailableDuration(new Date('2026-01-01T06:00:00'), schedule, noPending)
    ).toBe(120); // 06:00 -> 08:00
  });

  it('measures to end of day when nothing follows', () => {
    expect(getAvailableDuration(new Date('2026-01-01T06:00:00'), [], noPending)).toBe(1079);
  });
});
