import {describe, expect, it} from 'vitest';
import {AiError, describeAiError} from './chat';
import type {AiErrorKind} from './chat';

describe('describeAiError', () => {
  it.each<[AiErrorKind, RegExp]>([
    ['auth', /rejected this API key/],
    ['quota', /no credit/],
    ['rate-limit', /rate-limiting/],
    ['model', /not available to this key/],
    ['network', /Could not reach/],
    ['other', /returned an error: boom/],
  ])('explains %s errors', (kind, expected) => {
    expect(describeAiError(new AiError(kind, 'boom'))).toMatch(expected);
  });

  it('handles errors that did not come from a provider', () => {
    expect(describeAiError(new Error('oops'))).toMatch(/oops/);
    expect(describeAiError('weird')).toMatch(/Something went wrong/);
  });
});
