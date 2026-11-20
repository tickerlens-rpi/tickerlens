import {describe, expect, it} from 'vitest';
import {trendColor, trendStrength} from './chart_trend';

describe('trendStrength', () => {
  it('is zero for a flat price', () => {
    expect(trendStrength(0, '1M')).toBe(0);
  });

  it('scales a move against the range', () => {
    expect(trendStrength(0.05, '1M')).toBeCloseTo(0.5);
    expect(trendStrength(-0.15, '1Y')).toBeCloseTo(-0.5);
  });

  it('caps at full green or red', () => {
    expect(trendStrength(0.4, '1W')).toBe(1);
    expect(trendStrength(-0.9, '1M')).toBe(-1);
  });

  it('treats a missing change as flat', () => {
    expect(trendStrength(Number.NaN, '1W')).toBe(0);
  });
});

describe('trendColor', () => {
  it('blends toward green for a rise', () => {
    expect(trendColor(0.025, '1W')).toBe(
      'color-mix(in oklab, var(--up) 50%, var(--trend-flat))',
    );
  });

  it('blends toward red for a fall', () => {
    expect(trendColor(-0.2, '1M')).toBe(
      'color-mix(in oklab, var(--down) 100%, var(--trend-flat))',
    );
  });

  it('uses the neutral colour when flat', () => {
    expect(trendColor(0, '5Y')).toBe(
      'color-mix(in oklab, var(--up) 0%, var(--trend-flat))',
    );
  });
});
