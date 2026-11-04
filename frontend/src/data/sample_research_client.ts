/**
 * @fileoverview A ResearchClient that serves made-up sample data, so the
 * company page works before the central API serves real figures, and on
 * preview deployments that have no API at all.
 */

import {rankCompanies} from '../lib/company_search';
import {normalizeTicker} from '../lib/ticker';
import {dayChange, pointsForRange, weekChange} from '../lib/price_history';
import {generateSampleHistory} from '../lib/sample_prices';
import type {
  ChartRange,
  Company,
  NewsArticle,
  NewsSummary,
  Overview,
  PricePoint,
  ResearchClient,
} from './research';
import {SAMPLE_COMPANIES} from './sample/companies';
import {SAMPLE_NEWS} from './sample/news';
import {
  SAMPLE_AS_OF,
  SAMPLE_AS_OF_DAY,
  SAMPLE_HISTORY_START,
  SAMPLE_PROFILES,
} from './sample/profiles';

/** Tickers that have sample news and summaries; the page notice lists them. */
export const SAMPLE_NEWS_TICKERS: readonly string[] = Object.keys(SAMPLE_NEWS);

/** Serves the sample companies, figures, histories, news and summaries. */
export class SampleResearchClient implements ResearchClient {
  readonly usesSampleData = true;

  // Generated on first use: a five-year history is about 1,300 points.
  private readonly histories = new Map<string, PricePoint[]>();

  async searchCompanies(query: string): Promise<Company[]> {
    return rankCompanies(SAMPLE_COMPANIES, query);
  }

  async getCompany(ticker: string): Promise<Company | undefined> {
    const symbol = normalizeTicker(ticker);
    return SAMPLE_COMPANIES.find(company => company.ticker === symbol);
  }

  async getOverview(ticker: string): Promise<Overview | undefined> {
    const symbol = normalizeTicker(ticker);
    const profile = SAMPLE_PROFILES[symbol];
    const history = this.historyFor(symbol);
    if (!profile || history.length === 0) {
      return undefined;
    }
    return {
      price: profile.price,
      dayChange: dayChange(history),
      weekChange: weekChange(history),
      marketCap: profile.price * profile.sharesOutstanding,
      eps: profile.eps,
      peRatio: profile.eps > 0 ? profile.price / profile.eps : undefined,
      revenueGrowth: profile.revenueGrowth,
      asOf: SAMPLE_AS_OF,
    };
  }

  async getPriceHistory(
    ticker: string,
    range: ChartRange,
  ): Promise<PricePoint[]> {
    return pointsForRange(this.historyFor(normalizeTicker(ticker)), range);
  }

  async getNews(ticker: string): Promise<NewsArticle[]> {
    const coverage = SAMPLE_NEWS[normalizeTicker(ticker)];
    if (!coverage) {
      return [];
    }
    return [...coverage.articles].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
    );
  }

  async getNewsSummary(ticker: string): Promise<NewsSummary | undefined> {
    const coverage = SAMPLE_NEWS[normalizeTicker(ticker)];
    if (!coverage) {
      return undefined;
    }
    const bullets = coverage.summary.map(bullet => {
      const source = coverage.articles.find(
        candidate => candidate.id === bullet.sourceId,
      );
      if (!source) {
        // Requirement F7: a bullet without its source is never shown.
        throw new Error(
          `Sample bullet cites unknown article ${bullet.sourceId}`,
        );
      }
      return {text: bullet.text, source};
    });
    return {bullets, generatedAt: SAMPLE_AS_OF};
  }

  private historyFor(symbol: string): PricePoint[] {
    const cached = this.histories.get(symbol);
    if (cached) {
      return cached;
    }
    const profile = SAMPLE_PROFILES[symbol];
    if (!profile) {
      return [];
    }
    const {startDate, ...walk} = profile.history;
    const history = generateSampleHistory({
      ...walk,
      startDate: startDate ?? SAMPLE_HISTORY_START,
      endDate: SAMPLE_AS_OF_DAY,
      endPrice: profile.price,
    });
    this.histories.set(symbol, history);
    return history;
  }
}
