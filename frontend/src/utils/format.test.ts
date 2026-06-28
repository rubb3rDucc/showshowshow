import { describe, it, expect } from 'vitest';
import {
  formatAirDay,
  formatFullDate,
  formatWatchTime,
  formatEpisodeLabel,
} from './format';

// Local YYYY-MM-DD for a Date, matching how formatAirDay constructs dates.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

describe('formatAirDay', () => {
  it('labels today/tomorrow/yesterday relative to now', () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    const yesterday = new Date(today.getTime() - 86400000);

    expect(formatAirDay(ymd(today))).toBe('Today');
    expect(formatAirDay(ymd(tomorrow))).toBe('Tomorrow');
    expect(formatAirDay(ymd(yesterday))).toBe('Yesterday');
  });

  it('formats far-off dates as month + day', () => {
    // Far future so it always lands in the >7-days branch regardless of "now".
    expect(formatAirDay('2099-12-25')).toBe('Dec 25');
  });
});

describe('formatFullDate', () => {
  it('formats a YYYY-MM-DD date (date-only, timezone-safe)', () => {
    expect(formatFullDate('1996-06-09')).toBe('June 9, 1996');
  });

  it('accepts an ISO datetime by slicing the date portion', () => {
    expect(formatFullDate('1996-06-09T12:34:56Z')).toBe('June 9, 1996');
  });

  it('returns the input unchanged when unparseable', () => {
    expect(formatFullDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatWatchTime', () => {
  it('formats minutes, hours, and combinations', () => {
    expect(formatWatchTime(0)).toBe('0m');
    expect(formatWatchTime(45)).toBe('45m');
    expect(formatWatchTime(60)).toBe('1h');
    expect(formatWatchTime(90)).toBe('1h 30m');
    expect(formatWatchTime(125)).toBe('2h 5m');
  });
});

describe('formatEpisodeLabel', () => {
  it('returns null when season or episode is null', () => {
    expect(formatEpisodeLabel(null, 1)).toBeNull();
    expect(formatEpisodeLabel(1, null)).toBeNull();
  });

  it('zero-pads season and episode', () => {
    expect(formatEpisodeLabel(1, 2)).toBe('S01E02');
    expect(formatEpisodeLabel(12, 134)).toBe('S12E134');
  });

  it('appends the episode title when given', () => {
    expect(formatEpisodeLabel(1, 2, 'Pilot')).toBe('S01E02 · Pilot');
  });
});
