import {describe, expect, it} from 'vitest';
import {
  AI_CONNECTION_KEY,
  checkApiKey,
  codexModelsFor,
  describeAccount,
  forgetConnection,
  isAiConnection,
  maskApiKey,
  readConnection,
  saveConnection,
} from './connection';
import type {AiConnection} from './connection';

const CLAUDE: AiConnection = {
  provider: 'anthropic',
  apiKey: 'sk-ant-api03-abcdefghijklmnop',
  model: 'claude-opus-5-5',
  persistence: 'device',
};

describe('checkApiKey', () => {
  it('accepts well-formed keys for each provider', () => {
    expect(checkApiKey('anthropic', 'sk-ant-api03-xyz')).toBeUndefined();
    expect(checkApiKey('openai', 'sk-proj-xyz')).toBeUndefined();
    expect(checkApiKey('gemini', 'AIzaSyAbc123')).toBeUndefined();
  });

  it('flags empty keys, stray whitespace and the wrong provider', () => {
    expect(checkApiKey('anthropic', '')).toBe('empty');
    expect(checkApiKey('anthropic', 'sk-ant-a b')).toBe('whitespace');
    expect(checkApiKey('anthropic', 'sk-proj-xyz')).toBe('wrong-provider');
    expect(checkApiKey('openai', 'sk-ant-api03-xyz')).toBe('wrong-provider');
    expect(checkApiKey('openai', 'hello')).toBe('wrong-provider');
    expect(checkApiKey('gemini', 'sk-proj-xyz')).toBe('wrong-provider');
  });
});

describe('maskApiKey', () => {
  it('shows only the prefix and the last four characters', () => {
    expect(maskApiKey('sk-ant-api03-abcdefghijklmnop')).toBe('sk-ant-…mnop');
    expect(maskApiKey('sk-proj-1234567890abcd')).toBe('sk-…abcd');
    expect(maskApiKey('AIzaSyAbcdefghijklmnop')).toBe('AIza…mnop');
    expect(maskApiKey('short')).toBe('•••••');
  });
});

describe('saved connection', () => {
  it('keeps a device connection in localStorage only', () => {
    expect(saveConnection(CLAUDE)).toBe(true);
    expect(localStorage.getItem(AI_CONNECTION_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(AI_CONNECTION_KEY)).toBeNull();
    expect(readConnection()).toEqual(CLAUDE);
  });

  it('moves the key to sessionStorage when the user picks tab-only', () => {
    saveConnection(CLAUDE);
    saveConnection({...CLAUDE, persistence: 'session'});
    expect(localStorage.getItem(AI_CONNECTION_KEY)).toBeNull();
    expect(readConnection()).toEqual({...CLAUDE, persistence: 'session'});
  });

  it('ignores malformed stored data', () => {
    localStorage.setItem(AI_CONNECTION_KEY, JSON.stringify({provider: 'x'}));
    expect(readConnection()).toBeUndefined();
  });

  it('forgets the key everywhere', () => {
    saveConnection(CLAUDE);
    sessionStorage.setItem(AI_CONNECTION_KEY, JSON.stringify(CLAUDE));
    forgetConnection();
    expect(readConnection()).toBeUndefined();
    expect(localStorage.getItem(AI_CONNECTION_KEY)).toBeNull();
    expect(sessionStorage.getItem(AI_CONNECTION_KEY)).toBeNull();
  });
});

describe('ChatGPT plan connections', () => {
  const CODEX: AiConnection = {
    provider: 'codex',
    model: 'gpt-6-luna',
    persistence: 'device',
    tokens: {
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: '',
      accountId: 'acct-123',
      email: 'paul@example.com',
      plan: 'plus',
      expiresAt: 1_900_000_000_000,
    },
  };

  it('saves and reads back a signed-in plan', () => {
    expect(saveConnection(CODEX)).toBe(true);
    expect(readConnection()).toEqual(CODEX);
  });

  it('rejects a plan connection without its tokens', () => {
    expect(isAiConnection({...CODEX, tokens: undefined})).toBe(false);
    expect(
      isAiConnection({...CODEX, tokens: {...CODEX.tokens, accountId: ''}}),
    ).toBe(false);
    expect(isAiConnection({...CODEX, provider: 'anthropic'})).toBe(false);
  });

  it('names the account without showing any secret', () => {
    expect(describeAccount(CODEX)).toBe('paul@example.com (Plus plan)');
    expect(describeAccount(CLAUDE)).toBe(`key ${maskApiKey(CLAUDE.apiKey)}`);
  });

  it('offers paid-only models to paid plans only', () => {
    expect(codexModelsFor('free')).not.toContain('gpt-6.1-sol');
    expect(codexModelsFor('free')).toContain('gpt-6-luna');
    expect(codexModelsFor('pro')).toContain('gpt-6.1-sol');
  });
});
