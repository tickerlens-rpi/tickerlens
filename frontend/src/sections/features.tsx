import {FEATURES} from '../content/features';

export function Features() {
  return (
    <section className="section" id="features" aria-labelledby="features-title">
      <div className="container section__grid">
        <div className="section__aside">
          <p className="eyebrow">What you get</p>
          <h2 className="section__title" id="features-title">
            Read the market. Don’t <em>decode</em> it.
          </h2>
          <p className="section__intro">
            Most research tools hand you every number and assume you know what
            to do with them. TickerLens starts from the question you actually
            have.
          </p>
        </div>
        <ol className="features__list" aria-label="Planned features">
          {FEATURES.map((feature, index) => (
            <li className="feature" key={feature.id}>
              <span className="feature__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="feature__title">{feature.title}</h3>
              <p className="feature__desc">{feature.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
