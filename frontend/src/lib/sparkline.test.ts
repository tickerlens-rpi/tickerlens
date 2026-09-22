import {describe, expect, it} from 'vitest';
import {sparklinePath, sparklinePoints} from './sparkline';

const BOX = {width: 100, height: 50};

describe('sparklinePoints', () => {
  it('returns nothing for an empty series', () => {
    expect(sparklinePoints([], BOX)).toEqual([]);
  });

  it('spreads points evenly and maps min to the bottom, max to the top', () => {
    expect(sparklinePoints([0, 5, 10], BOX)).toEqual([
      {x: 0, y: 50},
      {x: 50, y: 25},
      {x: 100, y: 0},
    ]);
  });

  it('centres a flat series vertically', () => {
    expect(sparklinePoints([3, 3], BOX)).toEqual([
      {x: 0, y: 25},
      {x: 100, y: 25},
    ]);
  });

  it('keeps the stroke inside the padding', () => {
    const points = sparklinePoints([0, 10], {...BOX, padding: 5});
    expect(points[0]?.y).toBe(45);
    expect(points[1]?.y).toBe(5);
  });
});

describe('sparklinePath', () => {
  it('starts with a move and continues with lines', () => {
    expect(sparklinePath([0, 5, 10], BOX)).toBe('M0,50 L50,25 L100,0');
  });

  it('is empty for an empty series', () => {
    expect(sparklinePath([], BOX)).toBe('');
  });
});
