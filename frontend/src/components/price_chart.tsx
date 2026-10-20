import {useCallback, useId, useState} from 'react';
import type {KeyboardEvent, PointerEvent} from 'react';
import {CHART_RANGES} from '../data/research';
import type {ChartRange, PricePoint} from '../data/research';
import {useResearchClient} from '../data/research_context';
import {spreadIndexes, valueAxis} from '../lib/chart_scale';
import {addDays, formatDay, parseDay} from '../lib/dates';
import {
  daysBetween,
  formatAxisDate,
  formatAxisPrice,
  formatChange,
  formatLongDate,
  formatPrice,
  formatWeekdayDate,
} from '../lib/format';
import {useElementWidth} from '../lib/hooks';
import {changeAcross, rangeStart} from '../lib/price_history';
import {useAsync} from '../lib/use_async';

interface PriceChartProps {
  ticker: string;
  companyName: string;
}

interface RangeHistory {
  range: ChartRange;
  points: PricePoint[];
}

const RANGE_PHRASES: Record<ChartRange, string> = {
  '1W': 'past week',
  '1M': 'past month',
  '1Y': 'past year',
  '5Y': 'past five years',
};

/**
 * The simplified price chart (requirement F4): one line, four ranges and no
 * technical indicators. Hovering or focusing the chart reads out the close
 * on any day, and every point is also available as a table.
 */
export function PriceChart({ticker, companyName}: PriceChartProps) {
  const client = useResearchClient();
  const [range, setRange] = useState<ChartRange>('1M');
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const tableId = useId();
  // Each result remembers its range, so the chart kept on screen while the
  // next range loads is still labelled correctly.
  const loadHistory = useCallback(
    async (): Promise<RangeHistory> => ({
      range,
      points: await client.getPriceHistory(ticker, range),
    }),
    [client, ticker, range],
  );
  const history = useAsync(loadHistory);

  let shown: RangeHistory = {range, points: []};
  if (history.status === 'ready') {
    shown = history.value;
  } else if (history.status === 'loading' && history.previous) {
    shown = history.previous;
  }
  const {points} = shown;
  const first = points[0];
  const last = points[points.length - 1];
  const period =
    first && last && startsLate(first.date, last.date, shown.range)
      ? `since ${formatLongDate(first.date)}`
      : `over the ${RANGE_PHRASES[shown.range]}`;
  const description =
    first && last
      ? `${companyName} closing prices ${period}: ${formatPrice(first.close)} on ${formatLongDate(first.date)} to ${formatPrice(last.close)} on ${formatLongDate(last.date)}.`
      : '';

  return (
    <section className="chart" aria-labelledby={titleId}>
      <div className="chart__head">
        <h2 className="research__heading" id={titleId}>
          Price
        </h2>
        <div className="range" role="group" aria-label="Chart range">
          {CHART_RANGES.map(option => (
            <button
              key={option}
              type="button"
              className="range__option"
              aria-pressed={range === option}
              onClick={() => setRange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {first && last && (
        <p className="chart__summary">
          <strong>{formatChange(changeAcross(points))}</strong> {period}
        </p>
      )}
      <div
        className="chart__frame"
        data-loading={history.status === 'loading' || undefined}
      >
        {history.status === 'error' && (
          <p className="research__empty">
            The price history could not be loaded. Reload the page to try again.
          </p>
        )}
        {history.status === 'ready' && points.length < 2 && (
          <p className="research__empty">
            There is not enough price history to draw this range yet.
          </p>
        )}
        {points.length >= 2 && (
          <ChartPlot points={points} description={description} />
        )}
      </div>
      {points.length >= 2 && (
        <>
          <button
            type="button"
            className="chart__table-toggle"
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable(current => !current)}
          >
            {showTable ? 'Hide the price table' : 'Show prices as a table'}
          </button>
          <div id={tableId} className="chart__table-wrap" hidden={!showTable}>
            {showTable && (
              <PriceTable
                points={points}
                caption={`${companyName} closing prices ${period}, newest first`}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** True when a range starts well after where it should, as for a new listing. */
function startsLate(firstDay: string, lastDay: string, range: ChartRange) {
  const expected = parseDay(rangeStart(lastDay, range));
  // Weekends and weekly sampling can shift the first point by a few days.
  return firstDay > formatDay(addDays(expected, 7));
}

const PLOT_HEIGHT = 220;
const MARGIN = {top: 14, right: 76, bottom: 30, left: 56};
const FALLBACK_WIDTH = 640;
const MIN_PLOT_WIDTH = 120;

interface ChartPlotProps {
  points: readonly PricePoint[];
  description: string;
}

function ChartPlot({points, description}: ChartPlotProps) {
  const [measureRef, width] = useElementWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const [active, setActive] = useState<number>();

  const lastIndex = points.length - 1;
  const plotWidth = Math.max(
    width - MARGIN.left - MARGIN.right,
    MIN_PLOT_WIDTH,
  );
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
  const bottom = MARGIN.top + PLOT_HEIGHT;
  const closes = points.map(point => point.close);
  const axis = valueAxis(Math.min(...closes), Math.max(...closes));
  const x = (index: number) => MARGIN.left + (index / lastIndex) * plotWidth;
  const y = (value: number) =>
    MARGIN.top + (1 - (value - axis.min) / (axis.max - axis.min)) * PLOT_HEIGHT;

  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${round(x(index))},${round(y(point.close))}`,
    )
    .join(' ');
  const area = `${line} L${round(x(lastIndex))},${bottom} L${round(x(0))},${bottom} Z`;
  const dateTicks = spreadIndexes(points.length, width < 520 ? 3 : 5);
  const spanDays = daysBetween(points[0].date, points[lastIndex].date);
  const lastClose = closes[lastIndex];
  // A range with fewer points can arrive while a day is highlighted.
  const activeIndex =
    active === undefined ? undefined : Math.min(active, lastIndex);
  // The readout shows the newest close until the reader moves to another day.
  const shown = activeIndex ?? lastIndex;
  const shownPoint = points[shown];

  function move(index: number) {
    setActive(Math.max(0, Math.min(lastIndex, index)));
  }

  function handlePointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width > 0) {
      move(Math.round(((event.clientX - box.left) / box.width) * lastIndex));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const page = Math.max(1, Math.round(points.length / 10));
    const steps: Record<string, number> = {
      ArrowLeft: shown - 1,
      ArrowDown: shown - 1,
      ArrowRight: shown + 1,
      ArrowUp: shown + 1,
      PageDown: shown - page,
      PageUp: shown + page,
      Home: 0,
      End: lastIndex,
    };
    const next = steps[event.key];
    if (next !== undefined) {
      event.preventDefault();
      move(next);
    }
  }

  const tooltipAlign =
    x(shown) < MARGIN.left + 70
      ? 'start'
      : x(shown) > width - MARGIN.right - 30
        ? 'end'
        : 'middle';

  return (
    <div ref={measureRef} className="chart__plot">
      <svg
        className="chart__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={description}
      >
        {axis.ticks.map(tick => (
          <g key={tick}>
            <line
              className="chart__grid"
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={round(y(tick))}
              y2={round(y(tick))}
            />
            <text
              className="chart__tick"
              x={MARGIN.left - 10}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
            >
              {formatAxisPrice(tick)}
            </text>
          </g>
        ))}
        {dateTicks.map(index => (
          <text
            key={index}
            className="chart__tick"
            x={x(index)}
            y={bottom + 20}
            textAnchor={
              index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'
            }
          >
            {formatAxisDate(points[index].date, spanDays)}
          </text>
        ))}
        <path className="chart__area" d={area} />
        <path className="chart__line" d={line} />
        <circle
          className="chart__dot"
          cx={x(lastIndex)}
          cy={y(lastClose)}
          r={4}
        />
        <text
          className="chart__end-label"
          x={x(lastIndex) + 12}
          y={y(lastClose)}
          dy="0.32em"
        >
          {formatPrice(lastClose)}
        </text>
        {activeIndex !== undefined && (
          <g className="chart__crosshair">
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={MARGIN.top}
              y2={bottom}
            />
            <circle cx={x(activeIndex)} cy={y(closes[activeIndex])} r={4} />
          </g>
        )}
      </svg>
      {activeIndex !== undefined && shownPoint && (
        <div
          className={`chart__tooltip chart__tooltip--${tooltipAlign}`}
          style={{left: x(activeIndex), top: y(shownPoint.close)}}
          aria-hidden="true"
        >
          <strong>{formatPrice(shownPoint.close)}</strong>
          <span>{formatWeekdayDate(shownPoint.date)}</span>
        </div>
      )}
      <div
        className="chart__scrubber"
        style={{
          left: MARGIN.left,
          width: plotWidth,
          top: MARGIN.top,
          height: PLOT_HEIGHT,
        }}
        role="slider"
        tabIndex={0}
        aria-label="Closing price by day"
        aria-valuemin={0}
        aria-valuemax={lastIndex}
        aria-valuenow={shown}
        aria-valuetext={
          shownPoint
            ? `${formatWeekdayDate(shownPoint.date)}: ${formatPrice(shownPoint.close)}`
            : undefined
        }
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setActive(undefined)}
        onFocus={() => setActive(shown)}
        onBlur={() => setActive(undefined)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

function PriceTable({
  points,
  caption,
}: {
  points: readonly PricePoint[];
  caption: string;
}) {
  return (
    <table className="chart__table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Close</th>
        </tr>
      </thead>
      <tbody>
        {[...points].reverse().map(point => (
          <tr key={point.date}>
            <td>{formatLongDate(point.date)}</td>
            <td>{formatPrice(point.close)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
