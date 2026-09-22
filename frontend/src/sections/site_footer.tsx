const TEAM = [
  'Jiaying Wang',
  'Jialin (Gary) Fang',
  'Alexander Cavoli',
  'James Wu',
  'Nick Pillsbury',
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <p className="site-footer__brand">TickerLens</p>
          <p>A student project at Rensselaer Polytechnic Institute.</p>
        </div>
        <p className="site-footer__team">
          Team
          <br />
          {TEAM.join(' · ')}
        </p>
      </div>
    </footer>
  );
}
