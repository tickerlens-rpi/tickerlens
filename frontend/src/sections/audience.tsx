import {PERSONAS} from '../content/personas';

export function Audience() {
  return (
    <section
      className="section section--tint"
      id="who"
      aria-labelledby="who-title"
    >
      <div className="container">
        <p className="eyebrow">Who it’s for</p>
        <h2 className="section__title" id="who-title">
          Built for the first <em>real</em> question.
        </h2>
        <ul className="personas" aria-label="Personas">
          {PERSONAS.map(persona => (
            <li className="persona" key={persona.name}>
              <blockquote className="persona__quote">
                {persona.quote}
              </blockquote>
              <p className="persona__meta">
                {persona.name} · {persona.summary}
              </p>
              <p className="persona__need">{persona.need}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
