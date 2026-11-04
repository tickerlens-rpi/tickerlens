/**
 * @fileoverview The research data the company page shows, and the client
 * interface it loads that data through.
 *
 * `Company` mirrors the central API's response model in `api/app/models.py`.
 * The other shapes are the frontend's proposal for the endpoints the API adds
 * next (see `frontend/README.md`); keep both sides in step when either changes.
 */

/** Exchanges TickerLens covers in this release. */
export type Exchange = 'NYSE' | 'NASDAQ';

/** A listed company, as shown in search suggestions and page headers. */
export interface Company {
  ticker: string;
  name: string;
  exchange: Exchange;
}

/** The seven key figures on the company overview (requirement F2). */
export interface Overview {
  /** Latest price in US dollars. */
  price: number;
  /** Change since the previous close, as a fraction (0.012 is +1.2%). */
  dayChange: number;
  /** Change over the last five trading days, as a fraction. */
  weekChange: number;
  /** Market capitalisation in US dollars. */
  marketCap: number;
  /** Earnings per share over the past twelve months, in US dollars. */
  eps: number;
  /** Price-to-earnings ratio; absent when the company lost money. */
  peRatio?: number;
  /** Year-over-year revenue growth, as a fraction. */
  revenueGrowth: number;
  /** When these figures were last updated, as an ISO 8601 timestamp. */
  asOf: string;
}

/** Time ranges the simplified price chart offers (requirement F4). */
export const CHART_RANGES = ['1W', '1M', '1Y', '5Y'] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

/** One closing price. */
export interface PricePoint {
  /** Trading day, as YYYY-MM-DD. */
  date: string;
  /** Closing price in US dollars. */
  close: number;
}

/** A news article about a company, linking to the original. */
export interface NewsArticle {
  id: string;
  headline: string;
  publisher: string;
  /** Publication date, as YYYY-MM-DD or an ISO 8601 timestamp. */
  publishedAt: string;
  url: string;
}

/** One plain-language summary bullet and the article it came from (F6, F7). */
export interface SummaryBullet {
  text: string;
  source: NewsArticle;
}

/** AI summary of a company's recent news. */
export interface NewsSummary {
  bullets: SummaryBullet[];
  /** When the summary was generated, as an ISO 8601 timestamp. */
  generatedAt: string;
}

/**
 * Where the company page gets its data. The sample client serves made-up
 * data; the API client calls the central API. Pages depend only on this
 * interface, so either can be swapped in, including fakes in tests.
 */
export interface ResearchClient {
  /** True while any figures shown come from made-up sample data. */
  readonly usesSampleData: boolean;

  /** Companies matching a name or ticker, best match first. */
  searchCompanies(query: string): Promise<Company[]>;

  /** The company with this ticker, or undefined when there is none. */
  getCompany(ticker: string): Promise<Company | undefined>;

  /** Key figures for the company, or undefined when none are available. */
  getOverview(ticker: string): Promise<Overview | undefined>;

  /** Closing prices for the range, oldest first. */
  getPriceHistory(ticker: string, range: ChartRange): Promise<PricePoint[]>;

  /** Recent articles about the company, newest first. */
  getNews(ticker: string): Promise<NewsArticle[]>;

  /** AI summary of the recent news, or undefined when there is too little. */
  getNewsSummary(ticker: string): Promise<NewsSummary | undefined>;
}
