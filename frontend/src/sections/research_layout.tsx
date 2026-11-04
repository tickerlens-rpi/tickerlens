import type {ReactNode} from 'react';
import {ResearchHeader} from './research_header';
import {SiteFooter} from './site_footer';

/** The header, main landmark and footer every research page shares. */
export function ResearchLayout({children}: {children: ReactNode}) {
  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ResearchHeader />
      <main id="main" className="research">
        <div className="container research__inner">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
