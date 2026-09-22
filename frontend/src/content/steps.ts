/**
 * @fileoverview The "how it works" walkthrough, distilled from the second user
 * scenario in the vision document (Priya checking a stock that dropped).
 */

export interface Step {
  title: string;
  description: string;
}

export const STEPS: readonly Step[] = [
  {
    title: 'Search a ticker',
    description:
      'Type a company name or symbol. That is the only thing you need to know going in.',
  },
  {
    title: 'Read the summary',
    description:
      'A few plain-language bullets explain what is going on and whether a move is unusual for this stock.',
  },
  {
    title: 'Tap what you don’t know',
    description:
      'Every metric and piece of jargon has a dotted underline. Tap it for a short explanation, right where you are.',
  },
  {
    title: 'Check the source',
    description:
      'Each bullet is tagged with where it came from. Expand it to see the original article, its publisher and the date.',
  },
];
