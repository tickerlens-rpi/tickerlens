import {sparklinePath, sparklinePoints} from '../lib/sparkline';

interface SparklineProps {
  values: readonly number[];
  /** Accessible description of what the chart shows. */
  label: string;
}

const WIDTH = 320;
const HEIGHT = 96;
const PADDING = 6;

/** A single-line price chart with no axes: the simplest chart that still tells the story. */
export function Sparkline({values, label}: SparklineProps) {
  const box = {width: WIDTH, height: HEIGHT, padding: PADDING};
  const points = sparklinePoints(values, box);
  const line = sparklinePath(values, box);
  const first = points[0];
  const last = points[points.length - 1];
  const area =
    first && last ? `${line} L${last.x},${HEIGHT} L${first.x},${HEIGHT} Z` : '';

  return (
    <svg
      // Remount when the series changes so the draw animation replays.
      key={values.join(',')}
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
    >
      <path className="sparkline__area" d={area} />
      <line
        className="sparkline__baseline"
        x1="0"
        x2={WIDTH}
        y1={HEIGHT - 1}
        y2={HEIGHT - 1}
      />
      <path className="sparkline__line" d={line} pathLength={1} />
      {last && (
        <circle className="sparkline__dot" cx={last.x} cy={last.y} r="4" />
      )}
    </svg>
  );
}
