import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AiError} from './chat';
import type {ChatRequest} from './chat';
import {streamCodexChat} from './codex_provider';
import {AI_CONNECTION_KEY, readConnection} from './connection';
import type {CodexConnection} from './connection';

const RELAY = '/ai-proxy/codex';

const CONNECTION: CodexConnection = {
  provider: 'codex',
  model: 'gpt-6-luna',
  persistence: 'device',
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    idToken: '',
    accountId: 'acct-123',
    email: 'paul@example.com',
    plan: 'plus',
    expiresAt: Date.now() + 24 * 3600 * 1000,
  },
};

/** A streamed response whose body arrives in the given pieces. */
function sse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: {'Content-Type': 'text/event-stream'},
  });
}

function event(data: Record<string, unknown>): string {
  return `event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {status});
}

function request(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    connection: CONNECTION,
    system: 'Be brief.',
    messages: [
      {role: 'user', content: 'What does Apple do?'},
      {role: 'assistant', content: 'It makes iPhones.'},
      {role: 'user', content: 'And Macs?'},
    ],
    onText: () => {},
    ...overrides,
  };
}

describe('streamCodexChat', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends a Responses API request through the relay', async () => {
    const fetchJson = vi.fn(async () =>
      sse([event({type: 'response.completed', response: {}})]),
    );

    await streamCodexChat(request(), fetchJson, RELAY);

    const [url, init] = fetchJson.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/ai-proxy/codex/responses');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-1',
      'Chatgpt-Account-Id': 'acct-123',
      Originator: 'codex-tui',
      Accept: 'text/event-stream',
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: 'gpt-6-luna',
      instructions: '',
      stream: true,
      store: false,
    });
    expect(body.prompt_cache_key).toBe(
      (init.headers as Record<string, string>)['Session-Id'],
    );
    expect(body.input).toEqual([
      {
        type: 'message',
        role: 'developer',
        content: [{type: 'input_text', text: 'Be brief.'}],
      },
      {
        type: 'message',
        role: 'user',
        content: [{type: 'input_text', text: 'What does Apple do?'}],
      },
      {
        type: 'message',
        role: 'assistant',
        content: [{type: 'output_text', text: 'It makes iPhones.'}],
      },
      {
        type: 'message',
        role: 'user',
        content: [{type: 'input_text', text: 'And Macs?'}],
      },
    ]);
  });

  it('passes on streamed text, even when events are split mid-line', async () => {
    const whole =
      event({type: 'response.created'}) +
      event({type: 'response.output_text.delta', delta: 'Apple makes '}) +
      event({type: 'response.output_text.delta', delta: 'Macs too.'}) +
      event({type: 'response.completed', response: {}});
    const pieces = [whole.slice(0, 50), whole.slice(50, 140), whole.slice(140)];
    const onText = vi.fn();

    const ending = await streamCodexChat(
      request({onText}),
      vi.fn(async () => sse(pieces)),
      RELAY,
    );

    expect(ending).toBe('complete');
    expect(onText.mock.calls.map(call => call[0]).join('')).toBe(
      'Apple makes Macs too.',
    );
  });

  it('reports an answer cut off at its length limit', async () => {
    const ending = await streamCodexChat(
      request(),
      vi.fn(async () =>
        sse([
          event({type: 'response.output_text.delta', delta: 'Part'}),
          event({
            type: 'response.incomplete',
            response: {incomplete_details: {reason: 'max_output_tokens'}},
          }),
        ]),
      ),
      RELAY,
    );
    expect(ending).toBe('truncated');
  });

  it('treats a used-up plan allowance as a quota problem', async () => {
    const fetchJson = vi.fn(async () =>
      jsonResponse(
        {error: {type: 'usage_limit_reached', message: 'Limit reached'}},
        429,
      ),
    );
    const failure = streamCodexChat(request(), fetchJson, RELAY);
    await expect(failure).rejects.toBeInstanceOf(AiError);
    await expect(failure).rejects.toMatchObject({kind: 'quota'});
  });

  it('surfaces an error event sent in the middle of the stream', async () => {
    const failure = streamCodexChat(
      request(),
      vi.fn(async () =>
        sse([event({type: 'error', error: {type: 'rate_limit_exceeded'}})]),
      ),
      RELAY,
    );
    await expect(failure).rejects.toMatchObject({kind: 'rate-limit'});
  });

  it('fails clearly when the stream stops before the end', async () => {
    const failure = streamCodexChat(
      request(),
      vi.fn(async () =>
        sse([event({type: 'response.output_text.delta', delta: 'Half'})]),
      ),
      RELAY,
    );
    await expect(failure).rejects.toMatchObject({kind: 'network'});
  });

  it('refreshes the tokens once after a 401, saves them and retries', async () => {
    localStorage.setItem(AI_CONNECTION_KEY, JSON.stringify(CONNECTION));
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({detail: 'Unauthorized'}, 401))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            access_token: 'access-2',
            refresh_token: 'refresh-2',
            expires_in: 3600 * 24,
          },
          200,
        ),
      )
      .mockResolvedValueOnce(sse([event({type: 'response.completed'})]));

    await expect(streamCodexChat(request(), fetchJson, RELAY)).resolves.toBe(
      'complete',
    );

    expect(fetchJson.mock.calls[1]?.[0]).toBe(
      'https://auth.openai.com/oauth/token',
    );
    const retry = fetchJson.mock.calls[2]?.[1] as RequestInit;
    expect(retry.headers).toMatchObject({Authorization: 'Bearer access-2'});
    const saved = readConnection();
    expect(saved?.provider === 'codex' && saved.tokens.refreshToken).toBe(
      'refresh-2',
    );
  });

  it('refreshes ahead of time when the access token is about to run out', async () => {
    const expiring: CodexConnection = {
      ...CONNECTION,
      tokens: {...CONNECTION.tokens, expiresAt: Date.now() + 60_000},
    };
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {access_token: 'access-2', refresh_token: 'refresh-2'},
          200,
        ),
      )
      .mockResolvedValueOnce(sse([event({type: 'response.completed'})]));

    await streamCodexChat(request({connection: expiring}), fetchJson, RELAY);

    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect((fetchJson.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject(
      {Authorization: 'Bearer access-2'},
    );
  });

  it('asks the user to sign in again when the refresh is rejected', async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({detail: 'Unauthorized'}, 401))
      .mockResolvedValueOnce(
        jsonResponse({error: {message: 'refresh_token_reused'}}, 401),
      );
    await expect(
      streamCodexChat(request(), fetchJson, RELAY),
    ).rejects.toMatchObject({kind: 'auth'});
  });

  it('needs the TickerLens relay', async () => {
    await expect(
      streamCodexChat(request(), vi.fn(), undefined),
    ).rejects.toMatchObject({kind: 'network'});
  });

  it('reports a stopped request as aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchJson = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    await expect(
      streamCodexChat(request({signal: controller.signal}), fetchJson, RELAY),
    ).rejects.toMatchObject({kind: 'aborted'});
  });
});
