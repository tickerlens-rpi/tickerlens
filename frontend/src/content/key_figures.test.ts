import {describe, expect, it} from 'vitest';
import type {Company, Overview} from '../data/research';
import {SAMPLE_COMPANIES} from '../data/sample/companies';
import {SampleResearchClient} from '../data/sample_research_client';
import {countWords} from '../lib/text';
import {KEY_FIGURES, MAX_EXPLANATION_WORDS} from './key_figures';
import type {KeyFigure, KeyFigureId} from './key_figures';

const client = new SampleResearchClient();

async function sample(ticker: string): Promise<[Company, Overview]> {
  const company = SAMPLE_COMPANIES.find(entry => entry.ticker === ticker);
  const overview = await client.getOverview(ticker);
  if (!company || !overview) {
    throw new Error(`No sample data for ${ticker}`);
  }
  return [company, overview];
}

function figure(id: KeyFigureId): KeyFigure {
  const found = KEY_FIGURES.find(entry => entry.id === id);
  if (!found) {
    throw new Error(`No key figure ${id}`);
  }
  return found;
}

describe('KEY_FIGURES', () => {
  it('lists the seven figures from requirement F2, in order', () => {
    expect(KEY_FIGURES.map(entry => entry.label)).toEqual([
      'Price',
      '1-day change',
      '1-week change',
      'Market cap',
      'P/E ratio',
      'EPS',
      'Revenue growth',
    ]);
  });

  it.each(SAMPLE_COMPANIES.map(company => company.ticker))(
    'explains every figure for %s in 60 words or fewer (F3)',
    async ticker => {
      const [company, overview] = await sample(ticker);
      const tooLong = KEY_FIGURES.map(entry => ({
        label: entry.label,
        words: countWords(entry.explain(overview, company)),
      })).filter(entry => entry.words > MAX_EXPLANATION_WORDS);
      expect(tooLong).toEqual([]);
    },
  );

  it('puts the company’s own numbers into the explanation', async () => {
    const [apple, overview] = await sample('AAPL');
    expect(figure('peRatio').explain(overview, apple)).toContain(
      'Investors are paying about $34.80 for every $1 of profit Apple earned',
    );
  });

  it('shows no P/E for a company that lost money, and says why', async () => {
    const [spacex, overview] = await sample('SPCX');
    expect(figure('peRatio').value(overview)).toBe('n/a');
    expect(figure('peRatio').explain(overview, spacex)).toMatch(/lost money/);
    expect(figure('eps').explain(overview, spacex)).toMatch(
      /lost \$0\.42 per share/,
    );
  });
});
