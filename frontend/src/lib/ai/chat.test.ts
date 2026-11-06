import {describe, expect, it} from 'vitest';
import {AiError, describeAiError} from './chat';
import type {AiErrorKind} from './chat';

describe('describeAiError', () => {
  it.each<[AiErrorKind, RegExp]>([
    ['auth', /Anthropic did not accept this key/],
    ['quota', /out of API credit\. Add credit at console\.anthropic\.com/],
    ['rate-limit', /Too many questions/],
    ['model', /not available to this key/],
    ['network', /Could not reach Anthropic/],
    ['other', /Details: boom/],
  ])('explains %s errors', (kind, expected) => {
    expect(describeAiError(new AiError(kind, 'boom'), 'anthropic')).toMatch(
      expected,
    );
  });

  it('still reads well without a provider', () => {
    expect(describeAiError(new AiError('auth', 'x'))).toMatch(
      /The AI provider did not accept/,
    );
  });

  it('handles errors that did not come from a provider', () => {
    expect(describeAiError(new Error('oops'))).toMatch(/oops/);
    expect(describeAiError('weird')).toMatch(/Something went wrong/);
  });
});
