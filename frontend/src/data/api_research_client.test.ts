import {describe, expect, it, vi} from 'vitest';
import {ApiError, ApiResearchClient} from './api_research_client';

const APPLE = {ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ'};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function clientWith(response: Response | (() => Response)) {
  const fetchFunction = vi.fn(async () =>
    typeof response === 'function' ? response() : response,
  );
  const client = new ApiResearchClient('http://localhost:8000/', fetchFunction);
  return {client, fetchFunction};
}

/** The path and query of the URL `fetchFunction` was called with. */
function requestedPath(fetchFunction: ReturnType<typeof vi.fn>): string {
  const url = String(fetchFunction.mock.calls[0]?.[0]);
  return url.replace('http://localhost:8000', '');
}

describe('ApiResearchClient', () => {
  it('searches through the API', async () => {
    const {client, fetchFunction} = clientWith(
      jsonResponse({query: 'apple', results: [APPLE]}),
    );

    await expect(client.searchCompanies(' apple ')).resolves.toEqual([APPLE]);
    expect(fetchFunction).toHaveBeenCalledWith(
      'http://localhost:8000/companies/search?q=apple',
      expect.objectContaining({headers: {Accept: 'application/json'}}),
    );
  });

  it('does not call the API for a blank search', async () => {
    const {client, fetchFunction} = clientWith(jsonResponse({results: []}));
    await expect(client.searchCompanies('  ')).resolves.toEqual([]);
    expect(fetchFunction).not.toHaveBeenCalled();
  });

  it('looks up one company, and treats 404 as no company', async () => {
    const found = clientWith(jsonResponse(APPLE));
    await expect(found.client.getCompany('AAPL')).resolves.toEqual(APPLE);
    expect(found.fetchFunction).toHaveBeenCalledWith(
      'http://localhost:8000/companies/AAPL',
      expect.anything(),
    );

    const missing = clientWith(jsonResponse({detail: 'Unknown'}, 404));
    await expect(missing.client.getCompany('ZZZZ')).resolves.toBeUndefined();
  });

  it('reports server errors and malformed answers as ApiError', async () => {
    const failing = clientWith(jsonResponse({detail: 'Boom'}, 500));
    await expect(failing.client.searchCompanies('apple')).rejects.toThrow(
      ApiError,
    );

    const malformed = clientWith(
      jsonResponse({results: [{ticker: 'AAPL', exchange: 'LSE'}]}),
    );
    await expect(malformed.client.searchCompanies('apple')).rejects.toThrow(
      /not a company/,
    );
  });

  it('says its data is real, not sample data', () => {
    expect(clientWith(jsonResponse({})).client.usesSampleData).toBe(false);
  });

  it('turns the overview into fractions and leaves out missing figures', async () => {
    const {client, fetchFunction} = clientWith(
      jsonResponse({
        ticker: 'AAPL',
        name: 'Apple Inc',
        exchange: 'NASDAQ',
        price: 231.45,
        change_1d_pct: 1.2,
        change_1w_pct: -0.8,
        market_cap: 3_400_000_000_000,
        pe_ratio: 34.8,
        eps: 6.65,
        revenue_growth_pct: null,
        last_updated: '2026-11-05T21:21:13Z',
      }),
    );

    const overview = await client.getOverview('AAPL');

    expect(requestedPath(fetchFunction)).toBe('/companies/AAPL/overview');
    expect(overview).toEqual({
      price: 231.45,
      dayChange: 0.012,
      weekChange: -0.008,
      marketCap: 3_400_000_000_000,
      eps: 6.65,
      peRatio: 34.8,
      revenueGrowth: undefined,
      asOf: '2026-11-05T21:21:13Z',
    });
  });

  it('hides a P/E at or below zero, which means the company lost money', async () => {
    const {client} = clientWith(
      jsonResponse({price: 10, pe_ratio: -4.2, eps: -2.4, last_updated: 'x'}),
    );
    await expect(client.getOverview('LOSS')).resolves.toMatchObject({
      peRatio: undefined,
      eps: -2.4,
    });
  });

  it('treats a 404 as no figures, prices or news', async () => {
    const {client} = clientWith(() => jsonResponse({detail: 'No data'}, 404));
    await expect(client.getOverview('ZZZZ')).resolves.toBeUndefined();
    await expect(client.getPriceHistory('ZZZZ', '1M')).resolves.toEqual([]);
    await expect(client.getNews('ZZZZ')).resolves.toEqual([]);
  });

  it('reads price points for the chosen range', async () => {
    const points = [
      {date: '2026-10-30', close: 228.1},
      {date: '2026-10-31', close: 229.7},
    ];
    const {client, fetchFunction} = clientWith(
      jsonResponse({ticker: 'AAPL', range: '1W', points, last_updated: 'x'}),
    );

    await expect(client.getPriceHistory('AAPL', '1W')).resolves.toEqual(points);
    expect(requestedPath(fetchFunction)).toBe(
      '/companies/AAPL/prices?range=1W',
    );
  });

  it('rejects malformed price points', async () => {
    const {client} = clientWith(
      jsonResponse({points: [{date: '2026-10-30', close: 'lots'}]}),
    );
    await expect(client.getPriceHistory('AAPL', '1W')).rejects.toThrow(
      ApiError,
    );
  });

  it('reads news, keeping only web links and filling in gaps', async () => {
    const {client, fetchFunction} = clientWith(
      jsonResponse({
        ticker: 'AAPL',
        articles: [
          {
            headline: 'Apple unveils new chip',
            publisher: 'Reuters',
            published_at: '2026-11-05T14:30:00Z',
            url: 'https://example.com/chip',
            summary: 'Short summary.',
          },
          {
            headline: 'No publisher or date',
            publisher: null,
            published_at: null,
            url: 'https://example.com/plain',
            summary: null,
          },
          {headline: 'Same link again', url: 'https://example.com/chip'},
          {headline: 'Not a web link', url: 'javascript:alert(1)'},
          {headline: 'No link at all'},
        ],
        last_updated: 'x',
      }),
    );

    const articles = await client.getNews('AAPL');

    expect(requestedPath(fetchFunction)).toBe('/companies/AAPL/news?limit=10');
    expect(articles).toEqual([
      {
        id: 'https://example.com/chip',
        headline: 'Apple unveils new chip',
        publisher: 'Reuters',
        publishedAt: '2026-11-05T14:30:00Z',
        url: 'https://example.com/chip',
        summary: 'Short summary.',
      },
      {
        id: 'https://example.com/plain',
        headline: 'No publisher or date',
        publisher: 'Unknown publisher',
        publishedAt: undefined,
        url: 'https://example.com/plain',
        summary: undefined,
      },
    ]);
  });

  it('has no news summary of its own yet', async () => {
    const {client, fetchFunction} = clientWith(jsonResponse({}));
    await expect(client.getNewsSummary()).resolves.toBeUndefined();
    expect(fetchFunction).not.toHaveBeenCalled();
  });
});
