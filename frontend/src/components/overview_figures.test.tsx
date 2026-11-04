import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import type {Company, Overview} from '../data/research';
import {OverviewFigures} from './overview_figures';

const APPLE: Company = {ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ'};

const OVERVIEW: Overview = {
  price: 231.45,
  dayChange: 0.012,
  weekChange: -0.008,
  marketCap: 3.45e12,
  eps: 6.65,
  peRatio: 34.8,
  revenueGrowth: 0.061,
  asOf: '2026-10-20T20:00:00Z',
};

describe('OverviewFigures', () => {
  it('shows the seven key figures (F2)', () => {
    render(<OverviewFigures company={APPLE} overview={OVERVIEW} />);

    const values = screen
      .getAllByRole('definition')
      .map(element => element.textContent);
    expect(values).toEqual([
      '$231.45',
      '+1.2%',
      '−0.8%',
      '$3.45T',
      '34.8',
      '$6.65',
      '+6.1%',
    ]);
  });

  it('explains a figure when its label is opened (F3)', async () => {
    const user = userEvent.setup();
    render(<OverviewFigures company={APPLE} overview={OVERVIEW} />);
    const label = screen.getByRole('button', {name: 'P/E ratio'});

    await user.click(label);

    expect(label).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/paying about \$34\.80 for every \$1 of profit Apple/),
    ).toBeVisible();
  });

  it('switches to the next figure, as use case UC2 describes', async () => {
    const user = userEvent.setup();
    render(<OverviewFigures company={APPLE} overview={OVERVIEW} />);

    await user.click(screen.getByRole('button', {name: 'P/E ratio'}));
    await user.click(screen.getByRole('button', {name: 'EPS'}));

    expect(screen.getByRole('button', {name: 'P/E ratio'})).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText(/Apple earned \$6\.65 per share/)).toBeVisible();
    expect(screen.queryByText(/paying about/)).not.toBeInTheDocument();
  });

  it('closes with the Close button and with Escape', async () => {
    const user = userEvent.setup();
    render(<OverviewFigures company={APPLE} overview={OVERVIEW} />);

    await user.click(screen.getByRole('button', {name: 'Market cap'}));
    await user.click(screen.getByRole('button', {name: 'Close'}));
    expect(screen.queryByText(/For Apple that is/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Market cap'}));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', {name: 'Market cap'})).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
