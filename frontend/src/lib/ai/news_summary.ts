/**
 * @fileoverview The AI news summary (requirements F6 and F7), written by the
 * reader's own AI from the articles the company page shows.
 *
 * The model gets numbered articles and must answer with three to five short
 * bullets, each naming the article it came from. Bullets that cite no real
 * article are dropped, so every bullet shown has a source to check. A
 * summary is kept in this browser for a few hours, so reopening a page does
 * not spend the reader's credits again; each bullet carries its article, so
 * a kept summary still links to the right sources.
 */

import type {Company, NewsArticle, NewsSummary} from '../../data/research';
import {STORAGE_PREFIX, readJson, writeJson} from '../local_data';
import {AiError, streamChat} from './chat';
import type {ChatRequest} from './chat';
import type {AiConnection} from './connection';

/** The most articles the model reads: enough for a picture, not too costly. */
export const MAX_SUMMARY_ARTICLES = 8;

/** Requirement F6: three to five bullets. */
export const MAX_BULLETS = 5;

/** A cached summary is reused for this long. */
const CACHE_LIFETIME_MS = 6 * 60 * 60 * 1000;

const CACHE_KEY_PREFIX = `${STORAGE_PREFIX}newsSummary.`;

/** The instructions the model gets. */
export const SUMMARY_SYSTEM_PROMPT = [
  'You write the news summary inside TickerLens, a stock research tool for beginner investors.',
  'You get numbered news articles about one company. Summarise what is happening with the company in 3 to 5 bullets.',
  'Rules:',
  '- Use only facts stated in the articles. Do not add anything from your own knowledge.',
  '- Each bullet is one plain-language sentence of at most 30 words. Explain any financial term in a few words.',
  '- Each bullet cites exactly one article, by its number, that supports it. Cover different stories rather than repeating one.',
  '- Be neutral. Never predict prices and never say whether to buy, sell or hold.',
  '- If fewer than 3 articles are really about this company, write fewer bullets. If none are, return an empty list.',
  'Answer with JSON only, no other text, in exactly this shape:',
  '{"bullets": [{"text": "One sentence.", "source": 1}]}',
].join('\n');

/** Picks the articles to summarise: the newest few, newest first. */
export function summaryArticles(
  articles: readonly NewsArticle[],
): NewsArticle[] {
  return articles.slice(0, MAX_SUMMARY_ARTICLES);
}

/** The user message: the company and its numbered articles. */
export function buildSummaryRequest(
  company: Company,
  articles: readonly NewsArticle[],
): string {
  const lines = [
    `Company: ${company.name} (${company.ticker})`,
    '',
    'Articles:',
  ];
  articles.forEach((article, index) => {
    const date = article.publishedAt
      ? article.publishedAt.slice(0, 10)
      : 'date unknown';
    lines.push(`[${index + 1}] ${article.headline}`);
    lines.push(`Publisher: ${article.publisher}. Date: ${date}.`);
    if (article.summary) {
      lines.push(`Summary: ${article.summary.slice(0, 400)}`);
    }
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

/**
 * Reads the model's answer. Keeps at most five bullets, each with non-empty
 * text and a source number that matches an article.
 *
 * @throws AiError when the answer is not the JSON that was asked for.
 */
export function parseSummary(
  answer: string,
  articles: readonly NewsArticle[],
): NewsSummary['bullets'] {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  let parsed: unknown;
  try {
    parsed =
      start >= 0 && end > start
        ? JSON.parse(answer.slice(start, end + 1))
        : undefined;
  } catch {
    parsed = undefined;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.bullets)) {
    throw new AiError('other', 'The AI did not answer in the expected format.');
  }
  const bullets: NewsSummary['bullets'] = [];
  for (const item of parsed.bullets) {
    if (!isRecord(item) || typeof item.text !== 'string') {
      continue;
    }
    const text = item.text.replace(/\s+/g, ' ').trim();
    const source = articles[Number(item.source) - 1];
    if (text === '' || !Number.isInteger(Number(item.source)) || !source) {
      continue; // No real source: drop it rather than show an unsourced claim.
    }
    bullets.push({text, source});
    if (bullets.length === MAX_BULLETS) {
      break;
    }
  }
  return bullets;
}

interface SummarizeOptions {
  connection: AiConnection;
  company: Company;
  articles: readonly NewsArticle[];
  signal?: AbortSignal;
  /** Replaces the real provider call in tests. */
  chat?: (request: ChatRequest) => Promise<unknown>;
}

/** Asks the reader's AI for a summary of the articles. */
export async function summarizeNews({
  connection,
  company,
  articles,
  signal,
  chat = streamChat,
}: SummarizeOptions): Promise<NewsSummary> {
  const chosen = summaryArticles(articles);
  let answer = '';
  await chat({
    connection,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [{role: 'user', content: buildSummaryRequest(company, chosen)}],
    onText: text => {
      answer += text;
    },
    signal,
  });
  return {
    bullets: parseSummary(answer, chosen),
    generatedAt: new Date().toISOString(),
  };
}

interface CachedSummary {
  summary: NewsSummary;
  /** Which model wrote it, shown under the summary. */
  model: string;
}

/** A summary written for this company in the last few hours, if any. */
export function readCachedSummary(
  ticker: string,
  now = Date.now(),
  storage: Pick<Storage, 'getItem'> = localStorage,
): CachedSummary | undefined {
  const value = readJson(`${CACHE_KEY_PREFIX}${ticker}`, storage);
  if (!isCachedSummary(value)) {
    return undefined;
  }
  const age = now - Date.parse(value.summary.generatedAt);
  return age >= 0 && age < CACHE_LIFETIME_MS ? value : undefined;
}

/** Keeps a summary for later visits. */
export function saveCachedSummary(
  ticker: string,
  summary: NewsSummary,
  model: string,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  const entry: CachedSummary = {summary, model};
  writeJson(`${CACHE_KEY_PREFIX}${ticker}`, entry, storage);
}

function isCachedSummary(value: unknown): value is CachedSummary {
  return (
    isRecord(value) &&
    typeof value.model === 'string' &&
    isRecord(value.summary) &&
    typeof value.summary.generatedAt === 'string' &&
    Array.isArray(value.summary.bullets) &&
    value.summary.bullets.every(
      bullet =>
        isRecord(bullet) &&
        typeof bullet.text === 'string' &&
        isRecord(bullet.source) &&
        typeof bullet.source.id === 'string' &&
        typeof bullet.source.headline === 'string' &&
        typeof bullet.source.publisher === 'string' &&
        typeof bullet.source.url === 'string' &&
        // A stored link ends up in an href: only web links.
        /^https?:\/\//i.test(bullet.source.url),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
