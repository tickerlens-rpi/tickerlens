import {STEPS} from '../content/steps';

export function HowItWorks() {
  return (
    <section
      className="section section--tint"
      id="how-it-works"
      aria-labelledby="how-title"
    >
      <div className="container">
        <p className="eyebrow">How it works</p>
        <h2 className="section__title" id="how-title">
          Four minutes, <em>not</em> four tabs.
        </h2>
        <ol className="steps" aria-label="Steps">
          {STEPS.map((step, index) => (
            <li className="step" key={step.title}>
              <span className="step__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="step__title">{step.title}</h3>
              <p className="step__desc">{step.description}</p>
            </li>
          ))}
        </ol>
        <p className="how__timing">
          In our second user scenario, that whole loop takes{' '}
          <strong>about four minutes</strong>, without reading a full article or
          decoding a candlestick chart.
        </p>
      </div>
    </section>
  );
}
