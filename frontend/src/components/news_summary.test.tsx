import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Company, NewsArticle, ResearchClient} from '../data/research';
import {SampleResearchClient} from '../data/sample_research_client';
import {AiError} from '../lib/ai/chat';
import type {ChatRequest} from '../lib/ai/chat';
import {AI_CONNECTION_KEY} from '../lib/ai/connection';
import {renderWithProviders} from '../test/render';
import {NewsSummary} from './news_summary';

const streamChat = vi.hoisted(() => vi.fn());

vi.mock('../lib/ai/chat', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/ai/chat')>()),
  streamChat,
}));

const NIKE: Company = {ticker: 'NKE', name: 'Nike, Inc.', exchange: 'NYSE'};
const COKE: Company = {
  ticker: 'KO',
  name: 'The Coca-Cola Company',
  exchange: 'NYSE',
};

describe('NewsSummary', () => {
  it('lists plain-language bullets, each with a source tag (F6, F7)', async () => {
    renderWithProviders(<NewsSummary company={NIKE} />);

    const list = await screen.findByRole('list');
    const bullets = within(list).getAllByRole('listitem');
    expect(bullets).toHaveLength(3);
    for (const bullet of bullets) {
      expect(
        within(bullet).getByRole('button', {name: /^Source: /}),
      ).toBeInTheDocument();
    }
    expect(bullets[0]).toHaveTextContent('Nike lowered its full-year guidance');
  });

  it('shows the disclaimer under the AI summary (F8)', async () => {
    renderWithProviders(<NewsSummary company={NIKE} />);
    expect(
      await screen.findByText(/not investment advice/),
    ).toBeInTheDocument();
  });

  it('says when there is too little news, without the AI disclaimer', async () => {
    renderWithProviders(<NewsSummary company={COKE} />);

    expect(
      await screen.findByText(
        'There is not enough recent news about Coca-Cola to summarize yet.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Written by AI/)).not.toBeInTheDocument();
  });
});

describe('SourceTag', () => {
  it('opens the original article’s headline, publisher, date and link (F7)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsSummary company={NIKE} />);
    const tag = await screen.findByRole('button', {
      name: 'Source: Sample Wire · Oct 15',
    });

    await user.click(tag);

    expect(tag).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(
        'Nike lowers its full-year outlook as demand slows in China and North America',
      ),
    ).toBeVisible();
    expect(screen.getAllByText('Oct 15, 2026')[0]).toBeVisible();
    const link = screen.getByRole('link', {name: /Open original article/});
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/sample-news/nke-outlook-cut',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    await user.keyboard('{Escape}');
    expect(tag).toHaveAttribute('aria-expanded', 'false');
  });
});

const APPLE: Company = {ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ'};

const LIVE_NEWS: NewsArticle[] = [
  {
    id: 'https://example.com/chip',
    headline: 'Apple unveils a new chip',
    publisher: 'Reuters',
    publishedAt: '2026-11-05T14:30:00Z',
    url: 'https://example.com/chip',
  },
  {
    id: 'https://example.com/sales',
    headline: 'iPhone sales rise',
    publisher: 'CNBC',
    publishedAt: '2026-11-04T10:00:00Z',
    url: 'https://example.com/sales',
  },
];

/** A client like the API one: real news, no written summary. */
function liveClient(news: NewsArticle[] = LIVE_NEWS): ResearchClient {
  const sample = new SampleResearchClient();
  return {
    usesSampleData: false,
    searchCompanies: query => sample.searchCompanies(query),
    getCompany: ticker => sample.getCompany(ticker),
    getOverview: ticker => sample.getOverview(ticker),
    getPriceHistory: (ticker, range) => sample.getPriceHistory(ticker, range),
    getNews: async () => news,
    getNewsSummary: async () => undefined,
  };
}

function connect() {
  localStorage.setItem(
    AI_CONNECTION_KEY,
    JSON.stringify({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-5-5',
      persistence: 'device',
    }),
  );
}

describe('NewsSummary with live data', () => {
  beforeEach(() => {
    streamChat.mockReset();
  });

  it('offers to connect an AI when none is connected', async () => {
    renderWithProviders(<NewsSummary company={APPLE} />, {
      client: liveClient(),
    });
    expect(
      await screen.findByRole('link', {name: 'Connect your AI'}),
    ).toHaveAttribute('href', '/settings');
    expect(streamChat).not.toHaveBeenCalled();
  });

  it('writes a sourced summary with the connected AI when asked', async () => {
    connect();
    streamChat.mockImplementation(async ({onText}: ChatRequest) => {
      onText(
        '{"bullets":[{"text":"Apple showed a faster chip.","source":1},{"text":"iPhone sales grew.","source":2}]}',
      );
      return 'complete';
    });
    const user = userEvent.setup();
    renderWithProviders(<NewsSummary company={APPLE} />, {
      client: liveClient(),
    });

    await user.click(
      await screen.findByRole('button', {name: 'Summarize the news'}),
    );

    const list = await screen.findByRole('list');
    const bullets = within(list).getAllByRole('listitem');
    expect(bullets).toHaveLength(2);
    expect(bullets[0]).toHaveTextContent('Apple showed a faster chip.');
    expect(
      within(bullets[0]).getByRole('button', {name: /^Source: Reuters/}),
    ).toBeInTheDocument();
    expect(screen.getByText(/Written by AI from the articles/)).toBeVisible();
    expect(screen.getByText(/Written by Claude Haiku 5\.5/)).toBeVisible();
  });

  it('shows a kept summary again without asking the AI', async () => {
    connect();
    streamChat.mockImplementation(async ({onText}: ChatRequest) => {
      onText('{"bullets":[{"text":"Kept for later.","source":1}]}');
      return 'complete';
    });
    const user = userEvent.setup();
    const first = renderWithProviders(<NewsSummary company={APPLE} />, {
      client: liveClient(),
    });
    await user.click(
      await screen.findByRole('button', {name: 'Summarize the news'}),
    );
    await screen.findByText('Kept for later.');
    first.unmount();

    renderWithProviders(<NewsSummary company={APPLE} />, {
      client: liveClient(),
    });

    expect(await screen.findByText('Kept for later.')).toBeVisible();
    expect(streamChat).toHaveBeenCalledTimes(1);
  });

  it('explains a failure and offers to try again', async () => {
    connect();
    streamChat.mockRejectedValue(new AiError('rate-limit', 'Too fast'));
    const user = userEvent.setup();
    renderWithProviders(<NewsSummary company={APPLE} />, {
      client: liveClient(),
    });

    await user.click(
      await screen.findByRole('button', {name: 'Summarize the news'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Too many questions too quickly/,
    );
    expect(screen.getByRole('button', {name: 'Try again'})).toBeVisible();
  });

  it('says when there is no news to summarize', async () => {
    connect();
    const user = userEvent.setup();
    renderWithProviders(<NewsSummary company={APPLE} />, {
      client: liveClient([]),
    });

    await user.click(
      await screen.findByRole('button', {name: 'Summarize the news'}),
    );

    expect(
      await screen.findByText(/not enough recent news about Apple/),
    ).toBeVisible();
    expect(streamChat).not.toHaveBeenCalled();
  });
});
