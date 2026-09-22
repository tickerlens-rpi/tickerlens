/**
 * @fileoverview The two personas from the user scenarios. Their words are
 * paraphrased from the user stories.
 */

export interface Persona {
  name: string;
  summary: string;
  quote: string;
  need: string;
}

export const PERSONAS: readonly Persona[] = [
  {
    name: 'Paul, 21',
    summary: 'Student · first internship paycheck · no investing experience',
    quote: 'I want to invest wisely, but I don’t know what to look for.',
    need: 'Relevant news from different sources in one place, and an AI he can ask when the headlines don’t add up.',
  },
  {
    name: 'Priya, 24',
    summary: 'Dental hygienist · eight months in · two stocks',
    quote:
      'One of my stocks dropped a lot. Did something bad happen, or is this normal?',
    need: 'A short summary of what happened, the source behind it, and simple explanations of what she already owns.',
  },
];
