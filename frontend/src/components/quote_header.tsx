import type {Company, Overview} from '../data/research';
import {formatChange, formatPrice, formatUpdatedAt} from '../lib/format';

interface QuoteHeaderProps {
  company: Company;
  /** Absent while the figures load or when there are none. */
  overview?: Overview;
}

type Direction = 'up' | 'down' | 'flat';

const ARROWS: Record<Direction, string> = {up: '▲', down: '▼', flat: '■'};

/**
 * The top of a company page: name, ticker and exchange, the latest price, the
 * day and week changes, and when the figures were last updated.
 */
export function QuoteHeader({company, overview}: QuoteHeaderProps) {
  return (
    <header className="quote">
      <div className="quote__identity">
        <p className="quote__symbol">
          {company.ticker} · {company.exchange}
        </p>
        <h1 className="quote__name">{company.name}</h1>
      </div>
      {overview && (
        <div className="quote__price">
          <p className="quote__value">{formatPrice(overview.price)}</p>
          <ul className="quote__changes" aria-label="Price changes">
            <li>
              <Change value={overview.dayChange} period="today" />
            </li>
            <li>
              <Change value={overview.weekChange} period="this week" />
            </li>
          </ul>
          <p className="quote__updated">
            Last updated{' '}
            <time dateTime={overview.asOf}>
              {formatUpdatedAt(overview.asOf)}
            </time>
          </p>
        </div>
      )}
    </header>
  );
}

/** A change chip. The arrow and sign repeat what the colour says. */
function Change({value, period}: {value: number; period: string}) {
  const formatted = formatChange(value);
  let direction: Direction = 'flat';
  if (formatted.startsWith('+')) {
    direction = 'up';
  } else if (formatted !== '0.0%') {
    direction = 'down';
  }
  return (
    <span className={`change change--${direction}`}>
      <span aria-hidden="true">{ARROWS[direction]}</span> {formatted} {period}
    </span>
  );
}
