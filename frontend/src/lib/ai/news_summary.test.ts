import {describe, expect, it, vi} from 'vitest';
import type {Company, NewsArticle} from '../../data/research';
import {AiError} from './chat';
import type {ChatRequest} from './chat';
import type {AiConnection} from './connection';
import {
  MAX_SUMMARY_ARTICLES,
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryRequest,
  parseSummary,
  readCachedSummary,
  saveCachedSummary,
  summarizeNews,
} from './news_summary';

const APPLE: Company = {ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ'};

function article(n: number, extra: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: `https://example.com/${n}`,
    headline: `Headline ${n}`,
    publisher: n % 2 ? 'Reuters' : 'CNBC',
    publishedAt: `2026-11-0${(n % 5) + 1}T12:00:00Z`,
    url: `https://example.com/${n}`,
    ...extra,
  };
}

const ARTICLES = [1, 2, 3].map(n => article(n));

const CONNECTION: AiConnection = {
  provider: 'anthropic',
  apiKey: 'sk-ant-test',
  model: 'claude-haiku-5-5',
  persistence: 'device',
};

describe('buildSummaryRequest', () => {
  it('numbers the articles with their publisher, date and summary', () => {
    const text = buildSummaryRequest(APPLE, [
      article(1, {summary: 'Apple beat estimates.'}),
      article(2, {publishedAt: undefined}),
    ]);
    expect(text).toContain('Company: Apple Inc. (AAPL)');
    expect(text).toContain('[1] Headline 1');
    expect(text).toContain('Publisher: Reuters. Date: 2026-11-02.');
    expect(text).toContain('Summary: Apple beat estimates.');
    expect(text).toContain('[2] Headline 2');
    expect(text).toContain('Date: date unknown.');
  });
});

describe('parseSummary', () => {
  it('pairs each bullet with the article it cites', () => {
    const bullets = parseSummary(
      '{"bullets":[{"text":"Apple beat estimates.","source":2},{"text":"  Two   spaces. ","source":1}]}',
      ARTICLES,
    );
    expect(bullets).toEqual([
      {text: 'Apple beat estimates.', source: ARTICLES[1]},
      {text: 'Two spaces.', source: ARTICLES[0]},
    ]);
  });

  it('drops bullets that cite no real article, and keeps at most five', () => {
    const many = Array.from({length: 7}, (_, i) => ({
      text: `B${i}`,
      source: 1,
    }));
    const answer = JSON.stringify({
      bullets: [
        {text: 'Made up', source: 9},
        {text: 'No source'},
        {text: '', source: 1},
        {text: 'Fraction', source: 1.5},
        ...many,
      ],
    });
    const bullets = parseSummary(answer, ARTICLES);
    expect(bullets.map(bullet => bullet.text)).toEqual([
      'B0',
      'B1',
      'B2',
      'B3',
      'B4',
    ]);
  });

  it('finds the JSON inside a code fence or chatter', () => {
    const answer =
      'Here you go:\n```json\n{"bullets":[{"text":"Fine.","source":3}]}\n```';
    expect(parseSummary(answer, ARTICLES)).toHaveLength(1);
  });

  it('rejects an answer that is not the JSON asked for', () => {
    expect(() => parseSummary('Apple is doing well.', ARTICLES)).toThrow(
      AiError,
    );
    expect(() => parseSummary('{"summary": "x"}', ARTICLES)).toThrow(AiError);
  });
});

describe('summarizeNews', () => {
  it('sends the prompt and the newest articles, then parses the answer', async () => {
    const articles = Array.from({length: 12}, (_, i) => article(i + 1));
    const chat = vi.fn(async ({onText}: ChatRequest) => {
      onText('{"bullets":[{"text":"First.",');
      onText('"source":1}]}');
      return 'complete';
    });

    const summary = await summarizeNews({
      connection: CONNECTION,
      company: APPLE,
      articles,
      chat,
    });

    expect(summary.bullets).toEqual([{text: 'First.', source: articles[0]}]);
    expect(Date.parse(summary.generatedAt)).not.toBeNaN();
    const sent = chat.mock.calls[0]?.[0] as ChatRequest;
    expect(sent.system).toBe(SUMMARY_SYSTEM_PROMPT);
    expect(sent.connection).toBe(CONNECTION);
    const content = sent.messages[0]?.content ?? '';
    expect(content).toContain(`[${MAX_SUMMARY_ARTICLES}] Headline 8`);
    expect(content).not.toContain('[9]');
  });
});

describe('summary cache', () => {
  const summary = {
    bullets: [{text: 'Kept.', source: ARTICLES[0]}],
    generatedAt: '2026-11-05T12:00:00Z',
  };
  const generated = Date.parse(summary.generatedAt);

  it('keeps a summary for a few hours', () => {
    saveCachedSummary('AAPL', summary, 'gpt-6-luna');
    expect(readCachedSummary('AAPL', generated + 60_000)).toEqual({
      summary,
      model: 'gpt-6-luna',
    });
    expect(readCachedSummary('AAPL', generated + 7 * 3600 * 1000)).toBe(
      undefined,
    );
    expect(readCachedSummary('MSFT', generated)).toBeUndefined();
  });

  it('ignores a stored summary whose source is not a web link', () => {
    const tampered = {
      ...summary,
      bullets: [
        {text: 'Bad', source: {...ARTICLES[0], url: 'javascript:alert(1)'}},
      ],
    };
    saveCachedSummary('AAPL', tampered, 'gpt-6-luna');
    expect(readCachedSummary('AAPL', generated)).toBeUndefined();
  });
});
