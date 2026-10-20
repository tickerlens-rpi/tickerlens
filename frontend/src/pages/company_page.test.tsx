import {screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {SampleResearchClient} from '../data/sample_research_client';
import {renderWithProviders} from '../test/render';
import {CompanyPage} from './company_page';

function renderCompany(route: string, client = new SampleResearchClient()) {
  return renderWithProviders(<CompanyPage />, {
    client,
    route,
    path: '/company/:ticker',
  });
}

describe('CompanyPage', () => {
  it('brings the whole research workflow onto one page', async () => {
    renderCompany('/company/AAPL');

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Apple Inc.'}),
    ).toBeInTheDocument();
    for (const name of [
      'Key figures',
      'Price',
      'What’s happening',
      'Latest news',
    ]) {
      expect(
        await screen.findByRole('heading', {level: 2, name}),
      ).toBeInTheDocument();
    }
    expect(
      await screen.findByText('$231.45', {selector: '.quote__value'}),
    ).toBeInTheDocument();
    expect(document.title).toBe('Apple Inc. (AAPL) · TickerLens');
  });

  it('shows the disclaimer on the page and under the AI summary (F8)', async () => {
    renderCompany('/company/NKE');

    expect(
      await screen.findByText(/TickerLens does not give investment advice/),
    ).toBeInTheDocument();
    const summary = await screen.findByRole('region', {
      name: 'What’s happening',
    });
    expect(
      await within(summary).findByText(/not investment advice/),
    ).toBeInTheDocument();
  });

  it('labels made-up data as sample data', async () => {
    renderCompany('/company/AAPL');
    expect(
      await screen.findByText(/made up for the prototype/),
    ).toBeInTheDocument();
  });

  it('hides the sample notice once the data is real', async () => {
    const client = new SampleResearchClient();
    Object.defineProperty(client, 'usesSampleData', {value: false});
    renderCompany('/company/AAPL', client);

    await screen.findByRole('heading', {level: 1, name: 'Apple Inc.'});
    expect(screen.queryByText(/made up for the prototype/)).toBeNull();
  });

  it('sends lowercase and $-prefixed tickers to the canonical address', async () => {
    renderCompany('/company/aapl');
    expect(
      await screen.findByRole('heading', {level: 1, name: 'Apple Inc.'}),
    ).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/company/AAPL',
    );
  });

  it('offers a search when the ticker is unknown', async () => {
    renderCompany('/company/ZZZZ');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'No company found for “ZZZZ”',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('combobox', {name: 'Search a company or ticker'}),
    ).toHaveLength(2);
  });

  it('explains when the company cannot be loaded', async () => {
    const client = new SampleResearchClient();
    vi.spyOn(client, 'getCompany').mockRejectedValue(new Error('API down'));
    renderCompany('/company/AAPL', client);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'AAPL could not be loaded',
      }),
    ).toBeInTheDocument();
  });
});
