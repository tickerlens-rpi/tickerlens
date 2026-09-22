export function Disclaimer() {
  return (
    <section className="disclaimer" aria-labelledby="disclaimer-title">
      <div className="container disclaimer__inner">
        <div>
          <p className="eyebrow">Read this first</p>
          <h2 className="disclaimer__title" id="disclaimer-title">
            Research and education. Not advice.
          </h2>
        </div>
        <p className="disclaimer__text">
          TickerLens is a research and education tool. It is not financial
          advice, and AI summaries can be wrong. That is why every summary shows
          its source: check it, and consider talking to a licensed professional
          before making financial decisions.
        </p>
      </div>
    </section>
  );
}
