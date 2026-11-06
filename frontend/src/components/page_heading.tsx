import type {ReactNode} from 'react';

interface PageHeadingProps {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}

/** Eyebrow, `<h1>` and optional lede at the top of an app page. */
export function PageHeading({eyebrow, title, children}: PageHeadingProps) {
  return (
    <header className="app-page__head">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="app-page__title">{title}</h1>
      {children && <div className="app-page__lede">{children}</div>}
    </header>
  );
}
