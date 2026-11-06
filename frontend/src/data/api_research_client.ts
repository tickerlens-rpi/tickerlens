/**
 * @fileoverview A ResearchClient backed by the central API.
 *
 * The endpoints and their JSON shapes are documented in
 * `docs/CENTRAL_API_CONTRACT.md`. The API speaks snake_case and percentages
 * (1.2 means +1.2%); this client turns that into the camelCase fractions the
 * pages use, and treats a missing figure as absent rather than zero.
 */

import type {
  ChartRange,
  Company,
  Exchange,
  NewsArticle,
  NewsSummary,
  Overview,
  PricePoint,
  ResearchClient,
} from './research';

/** The API answered with an unexpected status or body. */
export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

const EXCHANGES: readonly Exchange[] = ['NYSE', 'NASDAQ'];

/** How many articles to ask for: enough for the news list and the summary. */
export const NEWS_ARTICLE_LIMIT = 10;

/**
 * The first request for a company can wait on the data providers, which the
 * API allows up to 30 seconds; give up a little after that.
 */
const REQUEST_TIMEOUT_MS = 45_000;

/** Calls the central API for everything the company page shows. */
export class ApiResearchClient implements ResearchClient {
  readonly usesSampleData = false;

  private readonly baseUrl: string;
  private readonly fetchJson: FetchFunction;

  /**
   * @param baseUrl Where the API is, for example `/api` behind the
   *     frontend's own server or http://localhost:8000.
   * @param fetchFunction Replaces `fetch` in tests.
   */
  constructor(
    baseUrl: string,
    fetchFunction: FetchFunction = (input, init) => fetch(input, init),
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchJson = fetchFunction;
  }

  async searchCompanies(query: string): Promise<Company[]> {
    const trimmed = query.trim();
    if (trimmed === '') {
      return [];
    }
    const body = await this.get(
      `/companies/search?q=${encodeURIComponent(trimmed.slice(0, 64))}`,
    );
    if (!isRecord(body) || !Array.isArray(body['results'])) {
      throw new ApiError('Search response has no results list');
    }
    return body['results'].map(parseCompany);
  }

  async getCompany(ticker: string): Promise<Company | undefined> {
    const body = await this.get(companyPath(ticker), {allowNotFound: true});
    return body === undefined ? undefined : parseCompany(body);
  }

  async getOverview(ticker: string): Promise<Overview | undefined> {
    const body = await this.get(`${companyPath(ticker)}/overview`, {
      allowNotFound: true,
    });
    return body === undefined ? undefined : parseOverview(body);
  }

  async getPriceHistory(
    ticker: string,
    range: ChartRange,
  ): Promise<PricePoint[]> {
    const body = await this.get(
      `${companyPath(ticker)}/prices?range=${encodeURIComponent(range)}`,
      {allowNotFound: true},
    );
    return body === undefined ? [] : parsePrices(body);
  }

  async getNews(ticker: string): Promise<NewsArticle[]> {
    const body = await this.get(
      `${companyPath(ticker)}/news?limit=${NEWS_ARTICLE_LIMIT}`,
      {allowNotFound: true},
    );
    return body === undefined ? [] : parseNews(body);
  }

  /**
   * The API has no AI service yet, so it never has a summary: the company
   * page asks the reader's own AI to write one from the news instead.
   */
  getNewsSummary(): Promise<NewsSummary | undefined> {
    return Promise.resolve(undefined);
  }

  /** GETs `path` and returns the parsed JSON, or undefined for an allowed 404. */
  private async get(
    path: string,
    options: {allowNotFound?: boolean} = {},
  ): Promise<unknown> {
    const response = await this.fetchJson(`${this.baseUrl}${path}`, {
      headers: {Accept: 'application/json'},
      signal: timeoutSignal(),
    });
    if (response.status === 404 && options.allowNotFound) {
      return undefined;
    }
    if (!response.ok) {
      throw new ApiError(
        `GET ${path} failed with status ${response.status}`,
        response.status,
      );
    }
    return response.json();
  }
}

function companyPath(ticker: string): string {
  return `/companies/${encodeURIComponent(ticker)}`;
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;
}

function parseCompany(value: unknown): Company {
  if (
    isRecord(value) &&
    typeof value['ticker'] === 'string' &&
    typeof value['name'] === 'string' &&
    isExchange(value['exchange'])
  ) {
    return {
      ticker: value['ticker'],
      name: value['name'],
      exchange: value['exchange'],
    };
  }
  throw new ApiError('Response is not a company');
}

function parseOverview(value: unknown): Overview {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value['price']) ||
    typeof value['last_updated'] !== 'string'
  ) {
    throw new ApiError('Response is not a company overview');
  }
  const peRatio = optionalNumber(value['pe_ratio']);
  return {
    price: value['price'],
    dayChange: percentToFraction(value['change_1d_pct']),
    weekChange: percentToFraction(value['change_1w_pct']),
    marketCap: optionalNumber(value['market_cap']),
    eps: optionalNumber(value['eps']),
    // A P/E at or below zero says the company lost money; it is not shown.
    peRatio: peRatio !== undefined && peRatio > 0 ? peRatio : undefined,
    revenueGrowth: percentToFraction(value['revenue_growth_pct']),
    asOf: value['last_updated'],
  };
}

function parsePrices(value: unknown): PricePoint[] {
  if (!isRecord(value) || !Array.isArray(value['points'])) {
    throw new ApiError('Response has no price points');
  }
  return value['points'].map(point => {
    if (
      isRecord(point) &&
      typeof point['date'] === 'string' &&
      isFiniteNumber(point['close'])
    ) {
      return {date: point['date'], close: point['close']};
    }
    throw new ApiError('Response has a malformed price point');
  });
}

function parseNews(value: unknown): NewsArticle[] {
  if (!isRecord(value) || !Array.isArray(value['articles'])) {
    throw new ApiError('Response has no articles list');
  }
  const seen = new Set<string>();
  const articles: NewsArticle[] = [];
  for (const item of value['articles']) {
    if (
      !isRecord(item) ||
      typeof item['headline'] !== 'string' ||
      typeof item['url'] !== 'string' ||
      // Only web links: an article URL ends up in an href.
      !/^https?:\/\//i.test(item['url']) ||
      seen.has(item['url'])
    ) {
      continue;
    }
    seen.add(item['url']);
    articles.push({
      id: item['url'],
      headline: item['headline'],
      publisher: optionalText(item['publisher']) ?? 'Unknown publisher',
      publishedAt: optionalText(item['published_at']),
      url: item['url'],
      summary: optionalText(item['summary']),
    });
  }
  return articles;
}

function percentToFraction(value: unknown): number | undefined {
  const percent = optionalNumber(value);
  return percent === undefined ? undefined : percent / 100;
}

function optionalNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExchange(value: unknown): value is Exchange {
  return EXCHANGES.some(exchange => exchange === value);
}
