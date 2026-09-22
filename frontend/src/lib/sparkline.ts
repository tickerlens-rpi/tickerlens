/**
 * @fileoverview Geometry helpers that turn a series of values into SVG path
 * data for the simplified price charts.
 */

export interface SparklineBox {
  width: number;
  height: number;
  /** Space kept clear at the top and bottom so the stroke is not clipped. */
  padding?: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Maps `values` onto evenly spaced points inside `box`. The smallest value
 * touches the bottom padding edge and the largest the top one; a flat series
 * sits in the vertical middle.
 */
export function sparklinePoints(
  values: readonly number[],
  box: SparklineBox,
): Point[] {
  if (values.length === 0) {
    return [];
  }
  const padding = box.padding ?? 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerHeight = box.height - 2 * padding;
  const stepX = values.length > 1 ? box.width / (values.length - 1) : 0;

  return values.map((value, index) => {
    const ratio = span === 0 ? 0.5 : (value - min) / span;
    return {
      x: round(index * stepX),
      y: round(padding + (1 - ratio) * innerHeight),
    };
  });
}

/** Builds an SVG path (`M x,y L x,y …`) through the sparkline points. */
export function sparklinePath(
  values: readonly number[],
  box: SparklineBox,
): string {
  return sparklinePoints(values, box)
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
