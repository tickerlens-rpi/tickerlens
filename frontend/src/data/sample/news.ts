/**
 * @fileoverview Made-up news and AI summaries for four sample companies.
 *
 * Headlines, publishers and links are invented for the prototype. The
 * publishers are fictional on purpose, so no real outlet is credited with a
 * story it never ran, and every link points at example.com.
 */

import type {NewsArticle} from '../research';

/** A summary bullet as the AI service returns it: text plus a source id. */
export interface SampleBullet {
  text: string;
  sourceId: string;
}

/** The articles and AI summary for one sample company. */
export interface SampleCoverage {
  articles: readonly NewsArticle[];
  summary: readonly SampleBullet[];
}

const SAMPLE_WIRE = 'Sample Wire';
const DEMO_DAILY = 'Demo Daily';
const EXAMPLE_LEDGER = 'Example Ledger';

function article(
  id: string,
  headline: string,
  publisher: string,
  publishedAt: string,
): NewsArticle {
  return {
    id,
    headline,
    publisher,
    publishedAt,
    url: `https://example.com/sample-news/${id}`,
  };
}

export const SAMPLE_NEWS: Readonly<Record<string, SampleCoverage>> = {
  AAPL: {
    articles: [
      article(
        'aapl-app-store-review',
        'European regulators widen their review of App Store fee rules',
        SAMPLE_WIRE,
        '2026-10-16',
      ),
      article(
        'aapl-services-growth',
        'Subscriptions keep growing as Apple bundles more of its services',
        DEMO_DAILY,
        '2026-10-14',
      ),
      article(
        'aapl-buyback',
        'Apple expands its share buyback program',
        EXAMPLE_LEDGER,
        '2026-10-12',
      ),
      article(
        'aapl-iphone-demand',
        'Early sales data points to steady demand for the newest iPhones',
        DEMO_DAILY,
        '2026-10-09',
      ),
      article(
        'aapl-ai-upgrades',
        'Analysts weigh how much new AI features will drive phone upgrades',
        SAMPLE_WIRE,
        '2026-10-07',
      ),
    ],
    summary: [
      {
        text: 'European regulators are reviewing App Store rules, which could reduce the fees Apple collects from app developers.',
        sourceId: 'aapl-app-store-review',
      },
      {
        text: 'Services such as the App Store and iCloud keep growing and make up a larger share of Apple’s profit.',
        sourceId: 'aapl-services-growth',
      },
      {
        text: 'Early sales data suggests steady demand for the newest iPhones, with no sign of a sharp slowdown.',
        sourceId: 'aapl-iphone-demand',
      },
      {
        text: 'Apple announced more share buybacks, which return cash to shareholders by reducing the number of shares.',
        sourceId: 'aapl-buyback',
      },
    ],
  },
  MSFT: {
    articles: [
      article(
        'msft-cloud-ai',
        'Microsoft’s cloud revenue keeps climbing as businesses adopt AI tools',
        DEMO_DAILY,
        '2026-10-15',
      ),
      article(
        'msft-data-centers',
        'Microsoft raises spending on data centers to meet AI demand',
        SAMPLE_WIRE,
        '2026-10-13',
      ),
      article(
        'msft-teams-review',
        'Regulators look at how Microsoft bundles Teams with Office',
        EXAMPLE_LEDGER,
        '2026-10-10',
      ),
      article(
        'msft-dividend',
        'Microsoft raises its quarterly dividend',
        SAMPLE_WIRE,
        '2026-10-08',
      ),
      article(
        'msft-xbox-prices',
        'New Xbox prices take effect ahead of the holidays',
        DEMO_DAILY,
        '2026-10-06',
      ),
    ],
    summary: [
      {
        text: 'Cloud revenue keeps growing as more businesses pay for AI tools that run on Microsoft’s servers.',
        sourceId: 'msft-cloud-ai',
      },
      {
        text: 'Microsoft is spending more on data centers, which raises costs now in exchange for more capacity later.',
        sourceId: 'msft-data-centers',
      },
      {
        text: 'Regulators are examining how Teams is bundled with Office, which could change how Microsoft sells them.',
        sourceId: 'msft-teams-review',
      },
      {
        text: 'Microsoft raised its quarterly dividend, the regular cash payment it makes to shareholders.',
        sourceId: 'msft-dividend',
      },
    ],
  },
  NKE: {
    articles: [
      article(
        'nke-shares-fall',
        'Nike shares fall sharply the day after its earnings report',
        DEMO_DAILY,
        '2026-10-16',
      ),
      article(
        'nke-running-shoes',
        'Nike executives point to new running shoes as a bright spot',
        EXAMPLE_LEDGER,
        '2026-10-16',
      ),
      article(
        'nke-outlook-cut',
        'Nike lowers its full-year outlook as demand slows in China and North America',
        SAMPLE_WIRE,
        '2026-10-15',
      ),
      article(
        'nke-cash',
        'Nike ends the quarter with large cash reserves',
        SAMPLE_WIRE,
        '2026-10-15',
      ),
      article(
        'nke-competition',
        'Newer running brands keep winning shelf space at sporting-goods stores',
        DEMO_DAILY,
        '2026-10-12',
      ),
    ],
    summary: [
      {
        text: 'Nike lowered its full-year guidance, saying demand has slowed in China and North America.',
        sourceId: 'nke-outlook-cut',
      },
      {
        text: 'The stock fell sharply the day after the report as investors lowered their expectations.',
        sourceId: 'nke-shares-fall',
      },
      {
        text: 'Management said its new running shoes are selling well and called them a bright spot.',
        sourceId: 'nke-running-shoes',
      },
    ],
  },
  TSLA: {
    articles: [
      article(
        'tsla-margins',
        'Lower-cost electric cars from rivals weigh on margins',
        SAMPLE_WIRE,
        '2026-10-16',
      ),
      article(
        'tsla-robotaxi',
        'Tesla’s robotaxi service expands to two more cities',
        DEMO_DAILY,
        '2026-10-14',
      ),
      article(
        'tsla-europe-prices',
        'Tesla cuts prices on two models in Europe',
        DEMO_DAILY,
        '2026-10-09',
      ),
      article(
        'tsla-deliveries',
        'Tesla deliveries come in slightly above last quarter',
        SAMPLE_WIRE,
        '2026-10-02',
      ),
      article(
        'tsla-energy-record',
        'Tesla’s energy storage business sets an installation record',
        EXAMPLE_LEDGER,
        '2026-10-02',
      ),
    ],
    summary: [
      {
        text: 'Cheaper electric cars from competitors are putting pressure on the profit Tesla makes on each car.',
        sourceId: 'tsla-margins',
      },
      {
        text: 'Price cuts on two models in Europe may help sales but usually shrink profit margins.',
        sourceId: 'tsla-europe-prices',
      },
      {
        text: 'Tesla delivered slightly more cars than last quarter, a sign that demand has steadied.',
        sourceId: 'tsla-deliveries',
      },
      {
        text: 'The energy storage business installed a record amount of batteries, a growing source of revenue.',
        sourceId: 'tsla-energy-record',
      },
    ],
  },
};
