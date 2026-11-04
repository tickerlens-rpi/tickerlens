/**
 * @fileoverview Hash-based routing.
 *
 * Routes live in the hash (`#/research/AAPL`) so the site works from any
 * static host without server rewrite rules. Hashes that do not start with
 * `#/` (for example `#features`) are in-page anchors on the landing page.
 */

import {parseTickerInput} from './ticker';

/** Every page the app can show. */
export type Route =
  | {page: 'home'}
  | {page: 'research'; ticker?: string}
  | {page: 'watchlist'}
  | {page: 'settings'}
  | {page: 'not-found'; path: string};

/** Page names, used for navigation links and the active-link highlight. */
export type PageName = Route['page'];

/** Turns `location.hash` into a route. */
export function parseHash(hash: string): Route {
  if (!hash.startsWith('#/')) {
    return {page: 'home'};
  }
  const segments = hash
    .slice(2)
    .split('/')
    .filter(segment => segment !== '');
  const [first, second] = segments;
  switch (first) {
    case undefined:
      return {page: 'home'};
    case 'research': {
      if (second === undefined) {
        return {page: 'research'};
      }
      const {ticker, error} = parseTickerInput(decodeURIComponent(second));
      return error ? {page: 'research'} : {page: 'research', ticker};
    }
    case 'watchlist':
      return {page: 'watchlist'};
    case 'settings':
      return {page: 'settings'};
    default:
      return {page: 'not-found', path: hash.slice(1)};
  }
}

/** Builds the `href` for a route. */
export function routeHref(route: Route): string {
  switch (route.page) {
    case 'home':
      return '#/';
    case 'research':
      return route.ticker
        ? `#/research/${encodeURIComponent(route.ticker)}`
        : '#/research';
    case 'watchlist':
      return '#/watchlist';
    case 'settings':
      return '#/settings';
    case 'not-found':
      return `#${route.path}`;
    default: {
      const unreachable: never = route;
      return unreachable;
    }
  }
}

/** Navigates to `route` by updating the hash, which fires `hashchange`. */
export function navigate(route: Route): void {
  window.location.hash = routeHref(route);
}
