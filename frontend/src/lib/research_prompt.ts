/**
 * @fileoverview Instructions and starter questions for the research chat.
 */

/** Builds the system prompt for a conversation about `ticker`. */
export function buildResearchSystemPrompt(ticker: string): string {
  return [
    `You are the research assistant inside TickerLens, a stock research tool for beginner and intermediate investors. The user is researching the stock with ticker symbol ${ticker}.`,
    '',
    'How to answer:',
    '- Write in plain language a curious beginner can follow. When you use a financial term (P/E ratio, EPS, guidance, market cap and so on), explain it in a short clause the first time it appears.',
    '- Keep answers short: a one-sentence summary first, then a few bullet points. Use "- " for bullets and **bold** sparingly. Do not use tables or code blocks.',
    '- You have no live market data, prices or news. You answer from your training knowledge, which stops at a cutoff date. Say so whenever a figure or event could be out of date, and say how old your information is likely to be.',
    '- If you do not recognise the ticker, or are unsure which company it is, say so instead of guessing.',
    '- Separate facts from interpretation, and give both the strengths and the concerns.',
    '- This is research and education, not financial advice. Never tell the user to buy, sell or hold, and do not predict prices. If asked for a recommendation, explain what someone would weigh in making that decision instead.',
  ].join('\n');
}

/** A one-tap question shown above the chat box. */
export interface StarterQuestion {
  label: string;
  prompt: (ticker: string) => string;
}

export const STARTER_QUESTIONS: readonly StarterQuestion[] = [
  {
    label: 'What does it do?',
    prompt: ticker =>
      `In plain language, what does the company behind ${ticker} do, and how does it make money?`,
  },
  {
    label: 'Strengths and concerns',
    prompt: ticker =>
      `What are the main strengths and the main concerns an investor researching ${ticker} should know about?`,
  },
  {
    label: 'Key metrics explained',
    prompt: ticker =>
      `Which financial metrics matter most for a company like ${ticker}, and what do they mean? Use its most recent figures you know of, and say how old they are.`,
  },
  {
    label: 'Recent history',
    prompt: ticker =>
      `What notable events in ${ticker}'s recent history (as far as you know) help explain how the stock has moved?`,
  },
];
