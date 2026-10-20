import {describe, expect, it} from 'vitest';
import type {PricePoint} from '../data/research';
import {weekdaysBetween} from './dates';
import {
  changeAcross,
  dayChange,
  pointsForRange,
  rangeStart,
  weekChange,
  weeklyCloses,
} from './price_history';

/** Daily closes 100, 101, 102, … for every weekday in the span. */
function steadyHistory(start: string, end: string): PricePoint[] {
  return weekdaysBetween(start, end).map((date, index) => ({
    date,
    close: 100 + index,
  }));
}

describe('rangeStart', () => {
  it('counts back one week, one month, one year or five years', () => {
    expect(rangeStart('2026-10-20', '1W')).toBe('2026-10-13');
    expect(rangeStart('2026-10-20', '1M')).toBe('2026-09-20');
    expect(rangeStart('2026-10-20', '1Y')).toBe('2025-10-20');
    expect(rangeStart('2026-10-20', '5Y')).toBe('2021-10-20');
  });
});

describe('pointsForRange', () => {
  const history = steadyHistory('2021-10-20', '2026-10-20');

  it('keeps every close in the past week', () => {
    const week = pointsForRange(history, '1W');
    expect(week.map(point => point.date)).toEqual([
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-19',
      '2026-10-20',
    ]);
  });

  it('covers the right span for each range (acceptance test for F4)', () => {
    for (const [range, start] of [
      ['1M', '2026-09-20'],
      ['1Y', '2025-10-20'],
      ['5Y', '2021-10-20'],
    ] as const) {
      const points = pointsForRange(history, range);
      expect(points[0].date >= start).toBe(true);
      // Weekends and weekly sampling move the first point by a few days at most.
      expect(points[0].date <= rangeStart('2026-10-27', range)).toBe(true);
      expect(points[points.length - 1].date).toBe('2026-10-20');
    }
  });

  it('samples five years weekly so the chart stays light', () => {
    const fiveYears = pointsForRange(history, '5Y');
    expect(fiveYears.length).toBeGreaterThan(255);
    expect(fiveYears.length).toBeLessThan(265);
  });

  it('returns nothing for an empty history', () => {
    expect(pointsForRange([], '1M')).toEqual([]);
  });
});

describe('weeklyCloses', () => {
  it('keeps the last close of each week, including a partial last week', () => {
    const points = steadyHistory('2026-10-05', '2026-10-20');
    expect(weeklyCloses(points).map(point => point.date)).toEqual([
      '2026-10-09',
      '2026-10-16',
      '2026-10-20',
    ]);
  });
});

describe('changes', () => {
  const history: PricePoint[] = [
    {date: '2026-10-12', close: 100},
    {date: '2026-10-13', close: 104},
    {date: '2026-10-14', close: 102},
    {date: '2026-10-15', close: 98},
    {date: '2026-10-16', close: 99},
    {date: '2026-10-19', close: 96},
    {date: '2026-10-20', close: 97.92},
  ];

  it('measures the day change from the previous close', () => {
    expect(dayChange(history)).toBeCloseTo(0.02);
  });

  it('measures the week change from five sessions back', () => {
    expect(weekChange(history)).toBeCloseTo(97.92 / 104 - 1);
  });

  it('treats too little history as no change', () => {
    expect(changeAcross([])).toBe(0);
    expect(changeAcross([{date: '2026-10-20', close: 5}])).toBe(0);
  });
});
