import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

// Testing Library only unmounts rendered trees automatically when Vitest
// globals are enabled. We keep explicit imports (Google style), so do it here.
afterEach(() => {
  cleanup();
});

// jsdom does not implement scrolling; the router scrolls to the top of each
// new page, so give it a no-op instead of a "not implemented" error.
Object.defineProperty(window, 'scrollTo', {value: () => {}, writable: true});
