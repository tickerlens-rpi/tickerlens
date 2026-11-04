import {describe, expect, it} from 'vitest';
import {
  addDays,
  addMonths,
  formatDay,
  parseDay,
  weekStart,
  weekdaysBetween,
} from './dates';

describe('parseDay and formatDay', () => {
  it('round-trips a calendar day without a time zone shift', () => {
    expect(formatDay(parseDay('2026-10-20'))).toBe('2026-10-20');
  });

  it('rejects text that is not a date', () => {
    expect(() => parseDay('20 October')).toThrow(/YYYY-MM-DD/);
  });
});

describe('addDays', () => {
  it('moves across month ends in both directions', () => {
    expect(formatDay(addDays(parseDay('2026-10-30'), 3))).toBe('2026-11-02');
    expect(formatDay(addDays(parseDay('2026-03-01'), -1))).toBe('2026-02-28');
  });
});

describe('addMonths', () => {
  it('keeps the day of the month when it exists', () => {
    expect(formatDay(addMonths(parseDay('2026-10-20'), -1))).toBe('2026-09-20');
    expect(formatDay(addMonths(parseDay('2026-10-20'), -60))).toBe(
      '2021-10-20',
    );
  });

  it('clamps to the last day of shorter months', () => {
    expect(formatDay(addMonths(parseDay('2026-03-31'), -1))).toBe('2026-02-28');
    expect(formatDay(addMonths(parseDay('2024-03-31'), -1))).toBe('2024-02-29');
  });
});

describe('weekStart', () => {
  it('returns the Monday of the week, counting Sunday as its last day', () => {
    expect(weekStart('2026-10-20')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
  });
});

describe('weekdaysBetween', () => {
  it('lists weekdays and skips weekends', () => {
    expect(weekdaysBetween('2026-10-15', '2026-10-20')).toEqual([
      '2026-10-15',
      '2026-10-16',
      '2026-10-19',
      '2026-10-20',
    ]);
  });

  it('is empty when the range is backwards', () => {
    expect(weekdaysBetween('2026-10-20', '2026-10-01')).toEqual([]);
  });
});
