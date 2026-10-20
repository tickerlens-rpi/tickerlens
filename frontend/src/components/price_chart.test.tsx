import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {SampleResearchClient} from '../data/sample_research_client';
import {renderWithProviders} from '../test/render';
import {PriceChart} from './price_chart';

function renderChart(client = new SampleResearchClient()) {
  return renderWithProviders(
    <PriceChart ticker="AAPL" companyName="Apple Inc." />,
    {client},
  );
}

describe('PriceChart', () => {
  it('opens on the past month and offers four ranges (F4)', async () => {
    renderChart();

    const ranges = screen.getByRole('group', {name: 'Chart range'});
    expect(
      within(ranges)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['1W', '1M', '1Y', '5Y']);
    expect(within(ranges).getByRole('button', {name: '1M'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await screen.findByRole('img', {
        name: /Apple Inc\. closing prices over the past month/,
      }),
    ).toBeInTheDocument();
  });

  it('redraws for a wider range', async () => {
    const user = userEvent.setup();
    renderChart();
    await screen.findByRole('img', {name: /past month/});

    await user.click(screen.getByRole('button', {name: '5Y'}));

    expect(
      await screen.findByRole('img', {
        name: /over the past five years: .* on Oct 2[0-9], 2021 to \$231\.45 on Oct 20, 2026/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/over the past five years/)).toBeVisible();
  });

  it('draws one price line and no indicator overlays', async () => {
    const {container} = renderChart();
    await screen.findByRole('img', {name: /past month/});

    expect(container.querySelectorAll('svg path.chart__line')).toHaveLength(1);
    expect(container.querySelectorAll('svg path')).toHaveLength(2);
  });

  it('reads out the close for each day from the keyboard', async () => {
    const user = userEvent.setup();
    renderChart();
    const slider = await screen.findByRole('slider', {
      name: 'Closing price by day',
    });

    await user.click(screen.getByRole('button', {name: '1W'}));
    await screen.findByRole('img', {name: /past week/});
    slider.focus();
    expect(slider).toHaveAttribute(
      'aria-valuetext',
      'Tue, Oct 20, 2026: $231.45',
    );

    await user.keyboard('{ArrowLeft}');
    expect(slider.getAttribute('aria-valuetext')).toMatch(
      /^Mon, Oct 19, 2026: \$\d+\.\d\d$/,
    );

    await user.keyboard('{Home}');
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^Tue, Oct 13, 2026/);
  });

  it('shows every point as a table on request', async () => {
    const user = userEvent.setup();
    renderChart();
    await user.click(screen.getByRole('button', {name: '1W'}));
    await screen.findByRole('img', {name: /past week/});

    await user.click(
      screen.getByRole('button', {name: 'Show prices as a table'}),
    );

    const table = screen.getByRole('table', {
      name: /closing prices over the past week/,
    });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(7);
    expect(rows[1]).toHaveTextContent('Oct 20, 2026$231.45');
  });

  it('explains when the history cannot be loaded', async () => {
    const client = new SampleResearchClient();
    vi.spyOn(client, 'getPriceHistory').mockRejectedValue(new Error('down'));
    renderChart(client);

    expect(
      await screen.findByText(/price history could not be loaded/),
    ).toBeInTheDocument();
  });
});
