/**
 * @fileoverview Picks round numbers for chart axes.
 */

/** A value axis: its bounds and the round tick values between them. */
export interface ValueAxis {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * Returns a "nice" step near `rawStep`: 1, 2, 2.5 or 5 times a power of ten,
 * so tick labels read $225, $230, $235 rather than $226.83.
 */
export function niceStep(rawStep: number): number {
  if (!(rawStep > 0) || !Number.isFinite(rawStep)) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / power;
  const nice = [1, 2, 2.5, 5, 10].find(candidate => fraction <= candidate);
  return (nice ?? 10) * power;
}

/**
 * Builds an axis that covers [low, high] with about `targetTicks` intervals,
 * widened outward to the nearest round values so the line never touches the
 * plot's top or bottom edge.
 */
export function valueAxis(
  low: number,
  high: number,
  targetTicks = 4,
): ValueAxis {
  let bottom = Math.min(low, high);
  let top = Math.max(low, high);
  if (top === bottom) {
    // A flat series still needs a visible band around it.
    const pad = Math.abs(bottom) * 0.01 || 1;
    bottom -= pad;
    top += pad;
  }
  const step = niceStep((top - bottom) / targetTicks);
  const min = Math.floor(bottom / step) * step;
  const max = Math.ceil(top / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toFixed(decimals)));
  }
  return {
    min: Number(min.toFixed(decimals)),
    max: Number(max.toFixed(decimals)),
    ticks,
  };
}

/** Picks up to `count` evenly spaced indexes into a list of `length`. */
export function spreadIndexes(length: number, count: number): number[] {
  if (length <= 0 || count <= 0) {
    return [];
  }
  if (length <= count) {
    return Array.from({length}, (_, index) => index);
  }
  const last = length - 1;
  if (count === 1) {
    return [last];
  }
  const indexes = new Set<number>();
  for (let i = 0; i < count; i++) {
    indexes.add(Math.round((i * last) / (count - 1)));
  }
  return [...indexes];
}
