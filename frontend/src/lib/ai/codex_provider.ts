/**
 * @fileoverview ChatGPT-plan models through Codex, for users who signed in
 * with their ChatGPT plan instead of pasting an API key.
 *
 * Requests use the Responses API at chatgpt.com/backend-api/codex, shaped
 * the way CLIProxyAPI sends them (`internal/runtime/executor/codex_*.go`).
 * chatgpt.com only accepts browser requests from its own pages, so they go
 * through the TickerLens server's relay (`CODEX_RELAY_URL`), which forwards
 * them unchanged apart from the headers a browser cannot set. The relay
 * keeps nothing.
 */

import {AiError} from './chat';
import type {ChatEnding, ChatRequest, ProviderClient} from './chat';
import {CodexSignInError, needsRefresh, refreshCodexTokens} from './codex_auth';
import {CODEX_RELAY_URL, readConnection, saveConnection} from './connection';
import type {CodexConnection} from './connection';

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

const REFRESH_LOCK = 'tickerlens-codex-refresh';

/** Streams a reply from a ChatGPT-plan model. */
export async function streamCodexChat(
  request: ChatRequest,
  fetchJson: FetchFunction = (input, init) => fetch(input, init),
  relayUrl: string | undefined = CODEX_RELAY_URL,
): Promise<ChatEnding> {
  const {connection, signal} = request;
  if (connection.provider !== 'codex') {
    throw new AiError('other', 'This connection is not a ChatGPT plan.');
  }
  if (!relayUrl) {
    throw new AiError(
      'network',
      'Signing in with a ChatGPT plan only works on a TickerLens server.',
    );
  }
  try {
    let current = needsRefresh(connection.tokens)
      ? await refreshAndSave(connection, fetchJson)
      : connection;
    let response = await send(request, current, relayUrl, fetchJson);
    if (response.status === 401) {
      // The token was revoked or ran out early: refresh once and retry.
      current = await refreshAndSave(current, fetchJson);
      response = await send(request, current, relayUrl, fetchJson);
    }
    if (!response.ok) {
      throw await errorFrom(response);
    }
    return await readEvents(response, request.onText);
  } catch (error) {
    throw toAiError(error, signal);
  }
}

function send(
  {system, messages, signal}: ChatRequest,
  connection: CodexConnection,
  relayUrl: string,
  fetchJson: FetchFunction,
): Promise<Response> {
  const sessionId = randomUuid();
  const body = {
    model: connection.model,
    instructions: '',
    input: [
      message('developer', system),
      ...messages.map(entry => message(entry.role, entry.content)),
    ],
    stream: true,
    store: false,
    reasoning: {effort: 'low'},
    include: ['reasoning.encrypted_content'],
    prompt_cache_key: sessionId,
  };
  return fetchJson(`${relayUrl.replace(/\/+$/, '')}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${connection.tokens.accessToken}`,
      'Chatgpt-Account-Id': connection.tokens.accountId,
      Originator: 'codex-tui',
      'Session-Id': sessionId,
    },
    body: JSON.stringify(body),
    signal,
  });
}

function message(role: 'developer' | 'user' | 'assistant', text: string) {
  return {
    type: 'message',
    role,
    content: [
      {type: role === 'assistant' ? 'output_text' : 'input_text', text},
    ],
  };
}

/**
 * Gets new tokens and saves them straight away, because OpenAI rejects a
 * refresh token once it has been used. Where the browser allows, a lock
 * keeps two tabs from refreshing at once.
 */
async function refreshAndSave(
  connection: CodexConnection,
  fetchJson: FetchFunction,
): Promise<CodexConnection> {
  const refresh = async (): Promise<CodexConnection> => {
    // Another tab may have refreshed while this one waited for the lock.
    const stored = readConnection();
    const latest =
      stored?.provider === 'codex' &&
      stored.tokens.accountId === connection.tokens.accountId
        ? stored
        : connection;
    if (
      latest.tokens.accessToken !== connection.tokens.accessToken &&
      !needsRefresh(latest.tokens)
    ) {
      return {...connection, tokens: latest.tokens};
    }
    const tokens = await refreshCodexTokens(latest.tokens, fetchJson);
    const next: CodexConnection = {...connection, tokens};
    saveConnection(next);
    return next;
  };
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(REFRESH_LOCK, refresh) : refresh();
}

/** Reads the server-sent events and passes on the text as it arrives. */
async function readEvents(
  response: Response,
  onText: (text: string) => void,
): Promise<ChatEnding> {
  if (!response.body) {
    throw new AiError('other', 'ChatGPT sent an empty answer.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  let ending: ChatEnding | undefined;
  let refused = false;

  const dispatch = () => {
    if (data.length === 0) {
      return;
    }
    const joined = data.join('\n');
    data = [];
    if (joined === '[DONE]') {
      ending ??= 'complete';
      return;
    }
    let event: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(joined);
      if (!isRecord(parsed)) {
        return;
      }
      event = parsed;
    } catch {
      return; // Not JSON: skip it rather than fail the whole answer.
    }
    switch (event.type) {
      case 'response.output_text.delta':
        if (typeof event.delta === 'string') {
          onText(event.delta);
        }
        break;
      case 'response.refusal.delta':
        if (typeof event.delta === 'string') {
          onText(event.delta);
        }
        refused = true;
        break;
      case 'response.completed':
      case 'response.done':
        ending = refused ? 'refused' : 'complete';
        break;
      case 'response.incomplete': {
        const response = isRecord(event.response) ? event.response : {};
        const details = isRecord(response.incomplete_details)
          ? response.incomplete_details
          : {};
        ending = details.reason === 'content_filter' ? 'refused' : 'truncated';
        break;
      }
      case 'error':
        throw errorFromBody(event.error ?? event, 0);
      case 'response.failed': {
        const response = isRecord(event.response) ? event.response : {};
        throw errorFromBody(response.error, 0);
      }
      default:
        break;
    }
  };

  for (;;) {
    const {done, value} = await reader.read();
    buffer += decoder.decode(value, {stream: !done});
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line === '') {
        dispatch();
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''));
      }
      newline = buffer.indexOf('\n');
    }
    if (done) {
      break;
    }
  }
  if (buffer.startsWith('data:')) {
    data.push(buffer.slice(5).replace(/^ /, ''));
  }
  dispatch();
  if (!ending) {
    throw new AiError('network', 'The answer stopped before it finished.');
  }
  return ending;
}

async function errorFrom(response: Response): Promise<AiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const error = isRecord(body) && 'error' in body ? body.error : body;
  return errorFromBody(error, response.status, body);
}

function errorFromBody(
  error: unknown,
  status: number,
  whole?: unknown,
): AiError {
  const record = isRecord(error) ? error : {};
  const type = text(record.type) ?? text(record.code) ?? '';
  const detail = isRecord(whole) ? text(whole.detail) : undefined;
  const message =
    text(record.message) ?? detail ?? (status ? `HTTP ${status}` : type);
  const statusCode = status || Number(record.status_code ?? record.status) || 0;
  if (type === 'usage_limit_reached') {
    return new AiError('quota', message);
  }
  if (statusCode === 429 || /rate_limit/.test(type)) {
    return new AiError('rate-limit', message);
  }
  if (
    statusCode === 401 ||
    /authentication|invalid_api_key|unauthorized/.test(type)
  ) {
    return new AiError('auth', message);
  }
  if (statusCode === 403 || /permission|forbidden/.test(type)) {
    return new AiError('permission', message);
  }
  if (statusCode === 404 || /model_not_found|not_found/.test(type)) {
    return new AiError('model', message);
  }
  return new AiError('other', message);
}

function toAiError(error: unknown, signal?: AbortSignal): AiError {
  if (error instanceof AiError) {
    return error;
  }
  if (
    signal?.aborted ||
    (error instanceof DOMException && error.name === 'AbortError')
  ) {
    return new AiError('aborted', 'Request was stopped.');
  }
  if (error instanceof CodexSignInError) {
    return new AiError('auth', error.message);
  }
  if (error instanceof TypeError) {
    return new AiError('network', error.message); // fetch's network failure
  }
  return new AiError(
    'other',
    error instanceof Error ? error.message : 'Unknown error',
  );
}

/**
 * A random UUID. `crypto.randomUUID` only exists on HTTPS pages, and the
 * team server is plain HTTP, so fall back to building one by hand.
 */
function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** ChatGPT-plan implementation of the provider interface. */
export const CODEX_PROVIDER: ProviderClient = {
  streamChat: request => streamCodexChat(request),
};
