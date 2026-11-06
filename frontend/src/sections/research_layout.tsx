import type {ReactNode} from 'react';

/**
 * The column every research page's content sits in. The header, main
 * landmark and footer come from the app layout around it.
 */
export function ResearchLayout({children}: {children: ReactNode}) {
  return (
    <div className="research">
      <div className="container research__inner">{children}</div>
    </div>
  );
}
