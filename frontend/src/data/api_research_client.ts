/**
 * @fileoverview A ResearchClient backed by the central API.
 *
 * The API serves company search and lookup today (`api/app/companies.py`).
 * Figures, price history, news and summaries come from the fallback client
 * until the API adds those endpoints; see the proposed contract in
 * `frontend/README.md`.
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

/** Calls the central API, delegating what it does not serve yet. */
export class ApiResearchClient implements ResearchClient {
  // Figures still come from the fallback, which serves sample data.
  readonly usesSampleData: boolean;

  private readonly baseUrl: string;
  private readonly fallback: ResearchClient;
  private readonly fetchJson: FetchFunction;

  /**
   * @param baseUrl Where the API runs, for example http://localhost:8000.
   * @param fallback Serves the data the API has no endpoint for yet.
   * @param fetchFunction Replaces `fetch` in tests.
   */
  constructor(
    baseUrl: string,
    fallback: ResearchClient,
    fetchFunction: FetchFunction = (input, init) => fetch(input, init),
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fallback = fallback;
    this.fetchJson = fetchFunction;
    this.usesSampleData = fallback.usesSampleData;
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
    const body = await this.get(`/companies/${encodeURIComponent(ticker)}`, {
      allowNotFound: true,
    });
    return body === undefined ? undefined : parseCompany(body);
  }

  getOverview(ticker: string): Promise<Overview | undefined> {
    return this.fallback.getOverview(ticker);
  }

  getPriceHistory(ticker: string, range: ChartRange): Promise<PricePoint[]> {
    return this.fallback.getPriceHistory(ticker, range);
  }

  getNews(ticker: string): Promise<NewsArticle[]> {
    return this.fallback.getNews(ticker);
  }

  getNewsSummary(ticker: string): Promise<NewsSummary | undefined> {
    return this.fallback.getNewsSummary(ticker);
  }

  /** GETs `path` and returns the parsed JSON, or undefined for an allowed 404. */
  private async get(
    path: string,
    options: {allowNotFound?: boolean} = {},
  ): Promise<unknown> {
    const response = await this.fetchJson(`${this.baseUrl}${path}`, {
      headers: {Accept: 'application/json'},
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExchange(value: unknown): value is Exchange {
  return EXCHANGES.some(exchange => exchange === value);
}
