import {describe, expect, it} from 'vitest';
import {dayChange, weekChange} from './price_history';
import {generateSampleHistory, seededRandom} from './sample_prices';

const BASE = {
  startDate: '2021-10-20',
  endDate: '2026-10-20',
  endPrice: 120,
  annualDrift: 0.1,
  annualVolatility: 0.3,
  seed: 7,
};

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = seededRandom(42);
    const second = seededRandom(42);
    const a = [first(), first(), first()];
    expect([second(), second(), second()]).toEqual(a);
    expect(a.every(value => value >= 0 && value < 1)).toBe(true);
  });
});

describe('generateSampleHistory', () => {
  it('is deterministic and ends on the requested price', () => {
    const history = generateSampleHistory(BASE);
    expect(generateSampleHistory(BASE)).toEqual(history);
    expect(history[history.length - 1]).toEqual({
      date: '2026-10-20',
      close: 120,
    });
  });

  it('only produces weekdays, oldest first', () => {
    const dates = generateSampleHistory(BASE).map(point => point.date);
    const weekends = dates.filter(date =>
      [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()),
    );
    expect(weekends).toEqual([]);
    expect(dates).toEqual([...new Set(dates)].sort());
  });

  it('pins the most recent daily returns', () => {
    const history = generateSampleHistory({
      ...BASE,
      recentReturns: [-0.012, 0.004, -0.072, -0.018, 0.004],
    });
    expect(dayChange(history)).toBeCloseTo(0.004, 3);
    expect(weekChange(history)).toBeCloseTo(-0.0924, 3);
  });

  it('keeps a mean-reverting stock near its level', () => {
    const history = generateSampleHistory({
      ...BASE,
      endPrice: 75,
      annualDrift: 0,
      meanReversion: {level: 75, strength: 6},
    });
    const closes = history.map(point => point.close);
    expect(Math.min(...closes)).toBeGreaterThan(45);
    expect(Math.max(...closes)).toBeLessThan(115);
  });

  it('starts at a later listing date when given one', () => {
    const history = generateSampleHistory({...BASE, startDate: '2026-06-12'});
    expect(history[0].date).toBe('2026-06-12');
  });
});
