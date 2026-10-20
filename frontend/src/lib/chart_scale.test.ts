import {describe, expect, it} from 'vitest';
import {niceStep, spreadIndexes, valueAxis} from './chart_scale';

describe('niceStep', () => {
  it('rounds to 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceStep(3.7)).toBe(5);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(0.13)).toBe(0.2);
    expect(niceStep(180)).toBe(200);
  });

  it('falls back to 1 for a step that cannot be used', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });
});

describe('valueAxis', () => {
  it('widens to round bounds that contain the data', () => {
    const axis = valueAxis(220.4, 233.9);
    expect(axis.min).toBeLessThanOrEqual(220.4);
    expect(axis.max).toBeGreaterThanOrEqual(233.9);
    expect(axis.ticks).toEqual([220, 225, 230, 235]);
  });

  it('keeps small steps free of floating-point noise', () => {
    expect(valueAxis(12.81, 13.62).ticks).toEqual([
      12.75, 13, 13.25, 13.5, 13.75,
    ]);
    expect(valueAxis(0.11, 0.37).ticks).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('gives a flat series a visible band', () => {
    const axis = valueAxis(50, 50);
    expect(axis.min).toBeLessThan(50);
    expect(axis.max).toBeGreaterThan(50);
  });
});

describe('spreadIndexes', () => {
  it('spreads ticks evenly and always includes both ends', () => {
    expect(spreadIndexes(22, 5)).toEqual([0, 5, 11, 16, 21]);
  });

  it('handles short lists and single ticks', () => {
    expect(spreadIndexes(3, 5)).toEqual([0, 1, 2]);
    expect(spreadIndexes(10, 1)).toEqual([9]);
    expect(spreadIndexes(0, 5)).toEqual([]);
  });
});
