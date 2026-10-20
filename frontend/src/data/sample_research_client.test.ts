import {describe, expect, it} from 'vitest';
import {countWords} from '../lib/text';
import {CHART_RANGES} from './research';
import type {Overview} from './research';
import {SAMPLE_COMPANIES} from './sample/companies';
import {
  SAMPLE_NEWS_TICKERS,
  SampleResearchClient,
} from './sample_research_client';

const client = new SampleResearchClient();
const ALL_TICKERS = SAMPLE_COMPANIES.map(company => company.ticker);

async function overviewOf(ticker: string): Promise<Overview> {
  const overview = await client.getOverview(ticker);
  if (!overview) {
    throw new Error(`No sample overview for ${ticker}`);
  }
  return overview;
}

describe('SampleResearchClient', () => {
  it('says its data is made up', () => {
    expect(client.usesSampleData).toBe(true);
  });

  it('finds companies the way the API does', async () => {
    const results = await client.searchCompanies('apple');
    expect(results.map(company => company.ticker)).toEqual(['AAPL', 'APLE']);
    expect(await client.getCompany('aapl')).toEqual({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
    });
    expect(await client.getCompany('ZZZZ')).toBeUndefined();
  });

  it.each(ALL_TICKERS)(
    'fills all seven key figures for %s (F2)',
    async ticker => {
      const overview = await overviewOf(ticker);
      expect(overview.price).toBeGreaterThan(0);
      expect(Number.isFinite(overview.dayChange)).toBe(true);
      expect(Number.isFinite(overview.weekChange)).toBe(true);
      expect(overview.marketCap).toBeGreaterThan(0);
      expect(Number.isFinite(overview.eps)).toBe(true);
      expect(Number.isFinite(overview.revenueGrowth)).toBe(true);
      expect(overview.asOf).toBe('2026-10-20T20:00:00Z');
      // P/E is the price over earnings, and only exists when there are any.
      expect(overview.peRatio).toBe(
        overview.eps > 0 ? overview.price / overview.eps : undefined,
      );
    },
  );

  it('matches the illustrative numbers in the user scenarios', async () => {
    const apple = await overviewOf('AAPL');
    expect(apple.price).toBe(231.45);
    expect(apple.dayChange).toBeCloseTo(0.012, 3);
    expect(apple.weekChange).toBeCloseTo(-0.008, 3);
    expect(apple.peRatio).toBeCloseTo(34.8, 1);
    expect(apple.eps).toBe(6.65);

    const nike = await overviewOf('NKE');
    expect(nike.price).toBe(71.8);
    expect(nike.weekChange).toBeCloseTo(-0.092, 3);
    // Priya's one-year view: the stock stayed between about $65 and $85.
    const year = await client.getPriceHistory('NKE', '1Y');
    const closes = year.map(point => point.close);
    expect(Math.min(...closes)).toBeGreaterThan(64);
    expect(Math.max(...closes)).toBeLessThan(86);
  });

  it.each(ALL_TICKERS)(
    'ends every chart range for %s on the latest price (F4)',
    async ticker => {
      const {price} = await overviewOf(ticker);
      for (const range of CHART_RANGES) {
        const points = await client.getPriceHistory(ticker, range);
        expect(points.length).toBeGreaterThan(4);
        expect(points[points.length - 1].close).toBe(price);
      }
    },
  );

  it.each(SAMPLE_NEWS_TICKERS)(
    'has five articles about %s from at least two publishers (F5)',
    async ticker => {
      const articles = await client.getNews(ticker);
      expect(articles).toHaveLength(5);
      expect(new Set(articles.map(a => a.publisher)).size).toBeGreaterThan(1);
      const dates = articles.map(article => article.publishedAt);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(
        articles.filter(a => !a.url.startsWith('https://example.com/')),
      ).toEqual([]);
    },
  );

  it.each(SAMPLE_NEWS_TICKERS)(
    'summarizes %s in 3 to 5 sourced bullets of at most 30 words (F6, F7)',
    async ticker => {
      const summary = await client.getNewsSummary(ticker);
      const articles = await client.getNews(ticker);
      const bullets = summary?.bullets ?? [];
      expect(bullets.length).toBeGreaterThanOrEqual(3);
      expect(bullets.length).toBeLessThanOrEqual(5);
      expect(bullets.filter(bullet => countWords(bullet.text) > 30)).toEqual(
        [],
      );
      expect(
        bullets.filter(bullet => !articles.includes(bullet.source)),
      ).toEqual([]);
    },
  );

  it('has no news or summary for companies without sample coverage', async () => {
    expect(await client.getNews('KO')).toEqual([]);
    expect(await client.getNewsSummary('KO')).toBeUndefined();
  });

  it('gives a company that listed recently a shorter history', async () => {
    const points = await client.getPriceHistory('SPCX', '5Y');
    expect(points[0].date >= '2026-06-12').toBe(true);
  });
});
