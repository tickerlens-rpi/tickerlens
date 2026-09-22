import {useState} from 'react';
import {GLOSSARY} from '../content/glossary';
import {Sparkline} from './sparkline';
import {Term} from './term';

type Range = '1M' | '1Y';

const RANGES: readonly Range[] = ['1M', '1Y'];

/** Fictional price history for the sample card. Not real market data. */
const PRICE_HISTORY: Record<Range, readonly number[]> = {
  '1M': [
    151, 152, 150, 153, 154, 152, 155, 156, 154, 157, 158, 156, 159, 161, 160,
    158, 157, 155, 152, 148, 146, 149, 147, 144, 143, 145, 142, 141, 143, 142,
  ],
  '1Y': [
    96, 101, 99, 108, 112, 118, 115, 124, 131, 128, 137, 142, 148, 151, 155,
    160, 158, 152, 145, 142,
  ],
};

const RANGE_LABELS: Record<Range, string> = {
  '1M': 'Sample price chart, past month',
  '1Y': 'Sample price chart, past year',
};

const RANGE_CAPTIONS: Record<Range, string> = {
  '1M': 'Past month: the drop stands out.',
  '1Y': 'Past year: still up about 48%. The drop is small next to it.',
};

/**
 * A mock company overview that demonstrates the product: plain-language
 * bullets, tagged sources, inline term explanations and a chart you can widen
 * to put a scary week into context. Everything shown is invented.
 */
export function SampleOverview() {
  const [range, setRange] = useState<Range>('1M');

  return (
    <article className="sample" aria-labelledby="sample-title">
      <span className="sample__badge">Sample data</span>

      <div className="sample__head">
        <div>
          <p className="sample__ticker">NWRB · fictional company</p>
          <h2 className="sample__name" id="sample-title">
            Northwind Robotics
          </h2>
        </div>
        <div className="sample__price">
          <p className="sample__price-value">$142.18</p>
          <p className="sample__change">−6.4% this week</p>
        </div>
      </div>

      <p className="sample__insight">
        This week’s move is bigger than a{' '}
        <Term {...GLOSSARY.typicalWeek}>typical week</Term> for NWRB, but small
        next to the past year.
      </p>

      <div className="sample__chart">
        <div className="sample__chart-head">
          <span className="sample__section-title">Price</span>
          <div className="range" role="group" aria-label="Chart range">
            {RANGES.map(option => (
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
        <Sparkline values={PRICE_HISTORY[range]} label={RANGE_LABELS[range]} />
        <p className="sample__caption">{RANGE_CAPTIONS[range]}</p>
      </div>

      <section className="sample__section" aria-labelledby="sample-what">
        <h3 className="sample__section-title" id="sample-what">
          What happened
        </h3>
        <ul className="sample__bullets">
          <li>
            Northwind lowered its <Term {...GLOSSARY.guidance}>guidance</Term>{' '}
            for the rest of the year after a large customer delayed orders.
            <span className="source-tag">Press release · Sep 9</span>
          </li>
          <li>
            <Term {...GLOSSARY.revenueGrowth}>Revenue growth</Term> slowed to
            4%, down from 11% last quarter.
            <span className="source-tag">Quarterly report</span>
          </li>
          <li>
            The company still holds more cash than debt, so the slowdown is not
            an immediate threat to day-to-day operations.
            <span className="source-tag">Balance sheet</span>
          </li>
        </ul>
      </section>

      <section className="sample__section" aria-labelledby="sample-metrics">
        <h3 className="sample__section-title" id="sample-metrics">
          Key metrics
        </h3>
        <dl className="metrics">
          <div className="metric">
            <dt>
              <Term {...GLOSSARY.peRatio} />
            </dt>
            <dd className="metric__value">18.2</dd>
          </div>
          <div className="metric">
            <dt>
              <Term {...GLOSSARY.eps} />
            </dt>
            <dd className="metric__value">$7.81</dd>
          </div>
          <div className="metric">
            <dt>
              <Term {...GLOSSARY.marketCap} />
            </dt>
            <dd className="metric__value">$9.4B</dd>
          </div>
          <div className="metric">
            <dt>
              <Term {...GLOSSARY.revenueGrowth} />
            </dt>
            <dd className="metric__value">+4%</dd>
          </div>
        </dl>
      </section>

      <div className="sample__split">
        <section aria-labelledby="sample-strengths">
          <h3
            className="sample__section-title sample__section-title--good"
            id="sample-strengths"
          >
            Strengths
          </h3>
          <ul>
            <li>More cash than debt</li>
            <li>Repeat customers</li>
          </ul>
        </section>
        <section aria-labelledby="sample-concerns">
          <h3
            className="sample__section-title sample__section-title--bad"
            id="sample-concerns"
          >
            Concerns
          </h3>
          <ul>
            <li>Lowered guidance</li>
            <li>Slower growth</li>
          </ul>
        </section>
      </div>
    </article>
  );
}
