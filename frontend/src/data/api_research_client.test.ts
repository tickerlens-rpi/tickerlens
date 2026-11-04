import {describe, expect, it, vi} from 'vitest';
import {ApiError, ApiResearchClient} from './api_research_client';
import {SampleResearchClient} from './sample_research_client';

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
  const client = new ApiResearchClient(
    'http://localhost:8000/',
    new SampleResearchClient(),
    fetchFunction,
  );
  return {client, fetchFunction};
}

describe('ApiResearchClient', () => {
  it('searches through the API', async () => {
    const {client, fetchFunction} = clientWith(
      jsonResponse({query: 'apple', results: [APPLE]}),
    );

    await expect(client.searchCompanies(' apple ')).resolves.toEqual([APPLE]);
    expect(fetchFunction).toHaveBeenCalledWith(
      'http://localhost:8000/companies/search?q=apple',
      {headers: {Accept: 'application/json'}},
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

  it('serves figures, prices and news from the fallback for now', async () => {
    const {client, fetchFunction} = clientWith(jsonResponse({}));
    expect(client.usesSampleData).toBe(true);
    await expect(client.getOverview('AAPL')).resolves.toMatchObject({
      price: 231.45,
    });
    await expect(client.getPriceHistory('AAPL', '1W')).resolves.toHaveLength(6);
    await expect(client.getNews('AAPL')).resolves.toHaveLength(5);
    await expect(client.getNewsSummary('AAPL')).resolves.toBeDefined();
    expect(fetchFunction).not.toHaveBeenCalled();
  });
});
