interface ResearchDisclaimerProps {
  /** `ai` sits under AI-written content; `page` near the top of every page. */
  context?: 'page' | 'ai';
}

/**
 * The research-and-education reminder (requirement F8): visible on every
 * company page and under every AI response.
 */
export function ResearchDisclaimer({
  context = 'page',
}: ResearchDisclaimerProps) {
  return (
    <p className={`research-disclaimer research-disclaimer--${context}`}>
      {context === 'ai'
        ? 'Written by AI from the articles cited. It can be wrong, so check the sources. For research and education only, not investment advice.'
        : 'For research and education only. TickerLens does not give investment advice or tell you what to buy or sell.'}
    </p>
  );
}
