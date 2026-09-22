import {COMPETITORS, TICKERLENS} from '../content/competitors';

export function Comparison() {
  return (
    <section className="section" id="compare" aria-labelledby="compare-title">
      <div className="container">
        <p className="eyebrow">Where it fits</p>
        <h2 className="section__title" id="compare-title">
          Great tools exist. They assume you <em>already know.</em>
        </h2>
        <table className="compare">
          <caption>
            Positioning from the TickerLens vision statement. Other platforms
            are excellent at what they are built for.
          </caption>
          <thead>
            <tr>
              <th scope="col">Platform</th>
              <th scope="col">Best at</th>
              <th scope="col">Keep in mind</th>
            </tr>
          </thead>
          <tbody>
            {COMPETITORS.map(platform => (
              <tr key={platform.name}>
                <th scope="row">{platform.name}</th>
                <td data-label="Best at">{platform.bestAt}</td>
                <td data-label="Keep in mind">{platform.keepInMind}</td>
              </tr>
            ))}
            <tr className="compare__us">
              <th scope="row">{TICKERLENS.name}</th>
              <td data-label="Best at">{TICKERLENS.bestAt}</td>
              <td data-label="Keep in mind">{TICKERLENS.keepInMind}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
