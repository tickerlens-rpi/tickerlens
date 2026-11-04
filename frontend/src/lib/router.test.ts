import {describe, expect, it} from 'vitest';
import {parseHash, routeHref} from './router';
import type {Route} from './router';

describe('parseHash', () => {
  it.each<[string, Route]>([
    ['', {page: 'home'}],
    ['#', {page: 'home'}],
    ['#/', {page: 'home'}],
    ['#features', {page: 'home'}],
    ['#/research', {page: 'research'}],
    ['#/research/', {page: 'research'}],
    ['#/research/aapl', {page: 'research', ticker: 'AAPL'}],
    ['#/research/BRK.B', {page: 'research', ticker: 'BRK.B'}],
    ['#/research/%24msft', {page: 'research', ticker: 'MSFT'}],
    ['#/research/not-a-ticker', {page: 'research'}],
    ['#/watchlist', {page: 'watchlist'}],
    ['#/settings', {page: 'settings'}],
    ['#/nope', {page: 'not-found', path: '/nope'}],
  ])('parses %j', (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected);
  });
});

describe('routeHref', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      {page: 'home'},
      {page: 'research'},
      {page: 'research', ticker: 'BRK.B'},
      {page: 'watchlist'},
      {page: 'settings'},
    ];
    for (const route of routes) {
      expect(parseHash(routeHref(route))).toEqual(route);
    }
  });
});
