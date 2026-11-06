import {describe, expect, it, vi} from 'vitest';
import {
  CODEX_CLIENT_ID,
  CodexSignInError,
  checkDeviceCode,
  jwtExpiry,
  needsRefresh,
  readIdentity,
  refreshCodexTokens,
  requestDeviceCode,
  waitForDeviceApproval,
} from './codex_auth';
import type {DeviceCode} from './codex_auth';
import type {CodexTokens} from './connection';

/** A JWT with this payload; the signature is never checked. */
function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({alg: 'none'})}.${encode(payload)}.signature`;
}

const ID_TOKEN = jwt({
  email: 'paul@example.com',
  'https://api.openai.com/auth': {
    chatgpt_account_id: 'acct-123',
    chatgpt_plan_type: 'Plus',
  },
});
const ACCESS_TOKEN = jwt({exp: 2_000_000_000});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

const CODE: DeviceCode = {
  deviceAuthId: 'device-1',
  userCode: 'ABCD-EFGH',
  intervalMs: 5000,
  expiresAt: Date.now() + 60_000,
};

describe('requestDeviceCode', () => {
  it('asks auth.openai.com for a code with the Codex client', async () => {
    const fetchJson = vi.fn(async () =>
      jsonResponse({
        device_auth_id: 'device-1',
        user_code: 'ABCD-EFGH',
        interval: '5',
        expires_at: '2026-11-06T04:00:00Z',
      }),
    );

    const code = await requestDeviceCode(fetchJson);

    expect(code).toEqual({
      deviceAuthId: 'device-1',
      userCode: 'ABCD-EFGH',
      intervalMs: 5000,
      expiresAt: Date.parse('2026-11-06T04:00:00Z'),
    });
    expect(fetchJson).toHaveBeenCalledWith(
      'https://auth.openai.com/api/accounts/deviceauth/usercode',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({client_id: CODEX_CLIENT_ID}),
      }),
    );
  });

  it('explains when device sign-in is unavailable', async () => {
    const fetchJson = vi.fn(async () => jsonResponse({}, 404));
    await expect(requestDeviceCode(fetchJson)).rejects.toThrow(
      /not available right now/,
    );
  });
});

describe('checkDeviceCode', () => {
  it('waits while OpenAI answers 403', async () => {
    const fetchJson = vi.fn(async () => jsonResponse({}, 403));
    await expect(checkDeviceCode(CODE, fetchJson)).resolves.toBeUndefined();
  });

  it('exchanges an approved code for tokens and reads the account', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          authorization_code: 'auth-code',
          code_verifier: 'verifier',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: ACCESS_TOKEN,
          refresh_token: 'refresh-1',
          id_token: ID_TOKEN,
          expires_in: 864000,
        }),
      );

    const tokens = await checkDeviceCode(CODE, fetchJson);

    expect(tokens).toEqual({
      accessToken: ACCESS_TOKEN,
      refreshToken: 'refresh-1',
      idToken: ID_TOKEN,
      accountId: 'acct-123',
      email: 'paul@example.com',
      plan: 'plus',
      expiresAt: 2_000_000_000_000,
    });
    const [url, init] = fetchJson.mock.calls[1];
    expect(url).toBe('https://auth.openai.com/oauth/token');
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      grant_type: 'authorization_code',
      client_id: CODEX_CLIENT_ID,
      code: 'auth-code',
      redirect_uri: 'https://auth.openai.com/deviceauth/callback',
      code_verifier: 'verifier',
    });
  });

  it('refuses an account without a ChatGPT plan', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({authorization_code: 'a', code_verifier: 'v'}),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: ACCESS_TOKEN,
          refresh_token: 'r',
          id_token: jwt({email: 'x@example.com'}),
        }),
      );
    await expect(checkDeviceCode(CODE, fetchJson)).rejects.toThrow(
      CodexSignInError,
    );
  });
});

describe('waitForDeviceApproval', () => {
  it('keeps asking until the code is approved', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(
        jsonResponse({authorization_code: 'a', code_verifier: 'v'}),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: ACCESS_TOKEN,
          refresh_token: 'r',
          id_token: ID_TOKEN,
        }),
      );
    const sleep = vi.fn(async () => {});

    const tokens = await waitForDeviceApproval(
      CODE,
      fetchJson,
      undefined,
      sleep,
    );

    expect(tokens.accountId).toBe('acct-123');
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(5000, undefined);
  });

  it('gives up when the code expires', async () => {
    const expired = {...CODE, expiresAt: Date.now() - 1};
    await expect(
      waitForDeviceApproval(expired, vi.fn(), undefined, async () => {}),
    ).rejects.toThrow(/expired/);
  });
});

describe('refreshCodexTokens', () => {
  const TOKENS: CodexTokens = {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    idToken: ID_TOKEN,
    accountId: 'acct-123',
    email: 'paul@example.com',
    plan: 'plus',
    expiresAt: 0,
  };

  it('trades the refresh token and keeps what OpenAI leaves out', async () => {
    const fetchJson = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >(async () =>
      jsonResponse({access_token: ACCESS_TOKEN, refresh_token: 'new-refresh'}),
    );

    const fresh = await refreshCodexTokens(TOKENS, fetchJson);

    expect(fresh).toMatchObject({
      accessToken: ACCESS_TOKEN,
      refreshToken: 'new-refresh',
      accountId: 'acct-123',
      email: 'paul@example.com',
    });
    const init = fetchJson.mock.calls[0]?.[1] ?? {};
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      client_id: CODEX_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: 'old-refresh',
      scope: 'openid profile email',
    });
  });

  it('reports a rejected refresh as a sign-in error', async () => {
    const fetchJson = vi.fn(async () =>
      jsonResponse({error: {message: 'refresh_token_reused'}}, 401),
    );
    await expect(refreshCodexTokens(TOKENS, fetchJson)).rejects.toThrow(
      'refresh_token_reused',
    );
  });
});

describe('token helpers', () => {
  it('reads the account, email and plan from the ID token', () => {
    expect(readIdentity(ID_TOKEN)).toEqual({
      accountId: 'acct-123',
      email: 'paul@example.com',
      plan: 'plus',
    });
    expect(readIdentity('not a jwt')).toEqual({});
  });

  it('reads expiry from a JWT', () => {
    expect(jwtExpiry(ACCESS_TOKEN)).toBe(2_000_000_000_000);
    expect(jwtExpiry('opaque')).toBeUndefined();
  });

  it('refreshes within an hour of expiry', () => {
    const now = 1_000_000;
    const tokens = {expiresAt: now + 30 * 60 * 1000} as CodexTokens;
    expect(needsRefresh(tokens, now)).toBe(true);
    expect(
      needsRefresh({...tokens, expiresAt: now + 2 * 3600 * 1000}, now),
    ).toBe(false);
  });
});
