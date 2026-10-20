import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {Company, Overview} from '../data/research';
import {QuoteHeader} from './quote_header';

const NIKE: Company = {ticker: 'NKE', name: 'Nike, Inc.', exchange: 'NYSE'};

const OVERVIEW: Overview = {
  price: 71.8,
  dayChange: 0.004,
  weekChange: -0.0924,
  marketCap: 106e9,
  eps: 2.1,
  peRatio: 34.2,
  revenueGrowth: -0.098,
  asOf: '2026-10-20T20:00:00Z',
};

describe('QuoteHeader', () => {
  it('names the company, its ticker and its exchange', () => {
    render(<QuoteHeader company={NIKE} />);
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(
      'Nike, Inc.',
    );
    expect(screen.getByText('NKE · NYSE')).toBeInTheDocument();
  });

  it('shows the price, both changes in words and when it was updated', () => {
    render(<QuoteHeader company={NIKE} overview={OVERVIEW} />);

    expect(screen.getByText('$71.80')).toBeInTheDocument();
    const changes = screen.getByRole('list', {name: 'Price changes'});
    expect(changes).toHaveTextContent('+0.4% today');
    expect(changes).toHaveTextContent('−9.2% this week');
    expect(screen.getByText(/Last updated/)).toHaveTextContent(
      'Last updated 4:00 PM ET, Oct 20',
    );
  });
});
