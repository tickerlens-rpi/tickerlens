/**
 * @fileoverview Signs in with a ChatGPT plan, the way OpenAI's Codex app
 * does, and keeps the tokens fresh.
 *
 * This follows CLIProxyAPI (github.com/router-for-me/CLIProxyAPI,
 * `sdk/auth/codex_device.go` and `internal/auth/codex/`): the device-code
 * flow under Codex's public OAuth client. The user approves a short code at
 * auth.openai.com, and the page exchanges the result for tokens. Every call
 * here goes from the browser straight to auth.openai.com, which accepts
 * requests from any site; the tokens are kept only in this browser.
 *
 * This is not an official OpenAI integration for other websites. OpenAI can
 * change or block it at any time.
 */

import type {CodexTokens} from './connection';

/** Codex's public OAuth client. */
export const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

const AUTH_ORIGIN = 'https://auth.openai.com';
const TOKEN_URL = `${AUTH_ORIGIN}/oauth/token`;
const DEVICE_CODE_URL = `${AUTH_ORIGIN}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${AUTH_ORIGIN}/api/accounts/deviceauth/token`;
const DEVICE_REDIRECT_URI = `${AUTH_ORIGIN}/deviceauth/callback`;

/** Where the user types the code. */
export const CODEX_DEVICE_PAGE = `${AUTH_ORIGIN}/codex/device`;

/** How long a device code lasts when OpenAI does not say. */
const DEFAULT_CODE_LIFETIME_MS = 15 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 5000;

/** Refresh this long before the access token runs out. */
const REFRESH_MARGIN_MS = 60 * 60 * 1000;

/** The claim in OpenAI's ID token that carries the ChatGPT account. */
const AUTH_CLAIM = 'https://api.openai.com/auth';

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

const defaultFetch: FetchFunction = (input, init) => fetch(input, init);

/** Why signing in failed, with a message fit to show the user. */
export class CodexSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodexSignInError';
  }
}

/** A code for the user to approve at {@link CODEX_DEVICE_PAGE}. */
export interface DeviceCode {
  deviceAuthId: string;
  userCode: string;
  /** How often to ask whether the user has approved it. */
  intervalMs: number;
  /** When the code stops working, in milliseconds since 1970. */
  expiresAt: number;
}

/** Asks OpenAI for a device code the user can approve. */
export async function requestDeviceCode(
  fetchJson: FetchFunction = defaultFetch,
  signal?: AbortSignal,
): Promise<DeviceCode> {
  const response = await post(
    fetchJson,
    DEVICE_CODE_URL,
    {client_id: CODEX_CLIENT_ID},
    signal,
  );
  if (response.status === 404) {
    throw new CodexSignInError(
      'OpenAI’s device sign-in is not available right now. Try again later, or connect with an API key instead.',
    );
  }
  const body = await readJson(response);
  if (!response.ok || !isRecord(body)) {
    throw new CodexSignInError(
      `OpenAI did not start the sign-in (status ${response.status}). Try again in a moment.`,
    );
  }
  const userCode = text(body.user_code) ?? text(body.usercode);
  const deviceAuthId = text(body.device_auth_id);
  if (!userCode || !deviceAuthId) {
    throw new CodexSignInError('OpenAI’s sign-in answer was incomplete.');
  }
  const seconds = Number(body.interval);
  const expiresAt = Date.parse(text(body.expires_at) ?? '');
  return {
    deviceAuthId,
    userCode,
    intervalMs:
      Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000
        : DEFAULT_POLL_INTERVAL_MS,
    expiresAt: Number.isFinite(expiresAt)
      ? expiresAt
      : Date.now() + DEFAULT_CODE_LIFETIME_MS,
  };
}

/**
 * Asks once whether the user has approved the code. Returns undefined while
 * they have not, and the tokens once they have.
 */
export async function checkDeviceCode(
  code: DeviceCode,
  fetchJson: FetchFunction = defaultFetch,
  signal?: AbortSignal,
): Promise<CodexTokens | undefined> {
  const response = await post(
    fetchJson,
    DEVICE_TOKEN_URL,
    {device_auth_id: code.deviceAuthId, user_code: code.userCode},
    signal,
  );
  // OpenAI answers 403 or 404 until the code is approved.
  if (response.status === 403 || response.status === 404) {
    return undefined;
  }
  const body = await readJson(response);
  if (!response.ok || !isRecord(body)) {
    throw new CodexSignInError(
      errorMessage(body) ??
        `The sign-in did not complete (status ${response.status}). Start again.`,
    );
  }
  const authorizationCode = text(body.authorization_code);
  const codeVerifier = text(body.code_verifier);
  if (!authorizationCode || !codeVerifier) {
    throw new CodexSignInError('OpenAI’s sign-in answer was incomplete.');
  }
  return exchangeAuthorizationCode(
    authorizationCode,
    codeVerifier,
    fetchJson,
    signal,
  );
}

/**
 * Asks every `code.intervalMs` until the user approves the code, then
 * returns their tokens. Stops with an error when the code expires, and with
 * an AbortError when `signal` aborts.
 */
export async function waitForDeviceApproval(
  code: DeviceCode,
  fetchJson: FetchFunction = defaultFetch,
  signal?: AbortSignal,
  sleep: (ms: number, signal?: AbortSignal) => Promise<void> = delay,
): Promise<CodexTokens> {
  while (Date.now() < code.expiresAt) {
    await sleep(code.intervalMs, signal);
    const tokens = await checkDeviceCode(code, fetchJson, signal);
    if (tokens) {
      return tokens;
    }
  }
  throw new CodexSignInError(
    'The code expired before it was approved. Start again.',
  );
}

async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
  fetchJson: FetchFunction,
  signal?: AbortSignal,
): Promise<CodexTokens> {
  const response = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CODEX_CLIENT_ID,
      code,
      redirect_uri: DEVICE_REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
    signal,
  });
  return readTokens(response);
}

/**
 * Trades the refresh token for new tokens. OpenAI replaces the refresh token
 * each time and rejects the old one, so the result must be saved at once.
 */
export async function refreshCodexTokens(
  tokens: CodexTokens,
  fetchJson: FetchFunction = defaultFetch,
  signal?: AbortSignal,
): Promise<CodexTokens> {
  const response = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: CODEX_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      scope: 'openid profile email',
    }).toString(),
    signal,
  });
  return readTokens(response, tokens);
}

/** Whether the access token runs out within the refresh margin. */
export function needsRefresh(tokens: CodexTokens, now = Date.now()): boolean {
  return tokens.expiresAt - now < REFRESH_MARGIN_MS;
}

/**
 * Reads a token response. Fields OpenAI leaves out on a refresh (the ID
 * token, the account) are kept from `previous`.
 */
async function readTokens(
  response: Response,
  previous?: CodexTokens,
): Promise<CodexTokens> {
  const body = await readJson(response);
  if (!response.ok || !isRecord(body)) {
    throw new CodexSignInError(
      errorMessage(body) ??
        `OpenAI did not accept the sign-in (status ${response.status}). Sign in again.`,
    );
  }
  const accessToken = text(body.access_token);
  const refreshToken = text(body.refresh_token) ?? previous?.refreshToken;
  const idToken = text(body.id_token) ?? previous?.idToken ?? '';
  if (!accessToken || !refreshToken) {
    throw new CodexSignInError('OpenAI’s sign-in answer had no tokens.');
  }
  const identity = readIdentity(idToken);
  const accountId = identity.accountId ?? previous?.accountId;
  if (!accountId) {
    throw new CodexSignInError(
      'This OpenAI account has no ChatGPT plan attached. Sign in with the account you use for ChatGPT.',
    );
  }
  const seconds = Number(body.expires_in);
  const expiresAt =
    jwtExpiry(accessToken) ??
    (Number.isFinite(seconds) && seconds > 0
      ? Date.now() + seconds * 1000
      : Date.now() + DEFAULT_CODE_LIFETIME_MS);
  return {
    accessToken,
    refreshToken,
    idToken,
    accountId,
    email: identity.email ?? previous?.email,
    plan: identity.plan ?? previous?.plan,
    expiresAt,
  };
}

/** The account, email and plan in an OpenAI ID token. */
export function readIdentity(idToken: string): {
  accountId?: string;
  email?: string;
  plan?: string;
} {
  const payload = jwtPayload(idToken);
  if (!payload) {
    return {};
  }
  const auth = isRecord(payload[AUTH_CLAIM]) ? payload[AUTH_CLAIM] : {};
  return {
    accountId: text(auth.chatgpt_account_id),
    email: text(payload.email),
    plan: text(auth.chatgpt_plan_type)?.toLowerCase(),
  };
}

/** When a JWT expires, in milliseconds since 1970, if it says. */
export function jwtExpiry(token: string): number | undefined {
  const exp = jwtPayload(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp)
    ? exp * 1000
    : undefined;
}

/**
 * Decodes a JWT's payload without checking its signature. That is fine
 * here: the token came straight from OpenAI over HTTPS, and OpenAI checks it
 * on every request anyway.
 */
function jwtPayload(token: string): Record<string, unknown> | undefined {
  const part = token.split('.')[1];
  if (!part) {
    return undefined;
  }
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function post(
  fetchJson: FetchFunction,
  url: string,
  body: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  return fetchJson(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Accept: 'application/json'},
    body: JSON.stringify(body),
    signal,
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorMessage(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const error = body.error;
  if (isRecord(error)) {
    return text(error.message);
  }
  return text(body.error_description) ?? text(error);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      {once: true},
    );
  });
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
