import {describe, expect, it} from 'vitest';
import {
  daysBetween,
  formatAxisDate,
  formatAxisPrice,
  formatChange,
  formatCompactUsd,
  formatLongDate,
  formatPercent,
  formatPrice,
  formatRatio,
  formatShortDate,
  formatUpdatedAt,
  formatWeekdayDate,
} from './format';

describe('number formats', () => {
  it('formats prices in dollars, with a true minus for losses', () => {
    expect(formatPrice(231.45)).toBe('$231.45');
    expect(formatPrice(1234.5)).toBe('$1,234.50');
    expect(formatPrice(-0.42)).toBe('−$0.42');
  });

  it('abbreviates large amounts to three significant digits', () => {
    expect(formatCompactUsd(3.4486e12)).toBe('$3.45T');
    expect(formatCompactUsd(106.3e9)).toBe('$106B');
    expect(formatCompactUsd(3.17e9)).toBe('$3.17B');
  });

  it('signs changes and keeps zero unsigned', () => {
    expect(formatChange(0.012)).toBe('+1.2%');
    expect(formatChange(-0.0081)).toBe('−0.8%');
    expect(formatChange(0.0004)).toBe('0.0%');
    expect(formatChange(-0.0004)).toBe('0.0%');
  });

  it('formats plain percentages, ratios and axis prices', () => {
    expect(formatPercent(-0.098)).toBe('9.8%');
    expect(formatRatio(34.804)).toBe('34.8');
    expect(formatAxisPrice(230)).toBe('$230');
    expect(formatAxisPrice(12.5)).toBe('$12.50');
  });
});

describe('date formats', () => {
  it('reads date-only strings as calendar days in any time zone', () => {
    expect(formatShortDate('2026-10-16')).toBe('Oct 16');
    expect(formatLongDate('2026-10-16')).toBe('Oct 16, 2026');
    expect(formatWeekdayDate('2026-10-16')).toBe('Fri, Oct 16, 2026');
  });

  it('shows the update time in New York market time', () => {
    expect(formatUpdatedAt('2026-10-20T20:00:00Z')).toBe('4:00 PM ET, Oct 20');
  });

  it('labels axis dates by how long the chart spans', () => {
    expect(formatAxisDate('2026-10-13', 7)).toBe('Oct 13');
    expect(formatAxisDate('2026-01-15', 365)).toBe('Jan ’26');
    expect(formatAxisDate('2024-01-15', 1826)).toBe('2024');
  });

  it('counts calendar days between two dates', () => {
    expect(daysBetween('2026-10-13', '2026-10-20')).toBe(7);
    expect(daysBetween('2021-10-20', '2026-10-20')).toBe(1826);
  });
});
