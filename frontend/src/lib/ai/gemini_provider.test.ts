import {afterEach, describe, expect, it, vi} from 'vitest';
import {AiError} from './chat';
import type {ApiKeyConnection} from './connection';
import {modelDisplayName} from './connection';
import {GEMINI_API_BASE, GEMINI_PROVIDER} from './gemini_provider';

const CONNECTION: ApiKeyConnection = {
  provider: 'gemini',
  apiKey: 'AIzaSyTestKey',
  model: 'gemini-flash-latest',
  persistence: 'device',
};

function sse(chunks: unknown[]): Response {
  const text = chunks
    .map(chunk => `data: ${JSON.stringify(chunk)}\r\n\r\n`)
    .join('');
  return new Response(text, {status: 200});
}

function textChunk(text: string, finishReason?: string) {
  return {candidates: [{content: {parts: [{text}]}, finishReason}]};
}

function ask(onText: (text: string) => void = () => {}) {
  return GEMINI_PROVIDER.streamChat({
    connection: CONNECTION,
    system: '',
    messages: [{role: 'user', content: 'Hi'}],
    onText,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GEMINI_PROVIDER.streamChat', () => {
  it('streams text and sends the key in a header, not the URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sse([textChunk('Hello, '), textChunk('world.', 'STOP')]),
      );
    vi.stubGlobal('fetch', fetchMock);
    const pieces: string[] = [];

    const ending = await GEMINI_PROVIDER.streamChat({
      connection: CONNECTION,
      system: 'Be brief.',
      messages: [
        {role: 'user', content: 'Hi'},
        {role: 'assistant', content: 'Hello'},
        {role: 'user', content: 'Again'},
      ],
      onText: text => pieces.push(text),
    });

    expect(ending).toBe('complete');
    expect(pieces.join('')).toBe('Hello, world.');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${GEMINI_API_BASE}/models/gemini-flash-latest:streamGenerateContent?alt=sse`,
    );
    expect(url).not.toContain('AIza');
    expect(init.headers).toMatchObject({'x-goog-api-key': 'AIzaSyTestKey'});
    const body = JSON.parse(init.body as string) as {
      systemInstruction: unknown;
      contents: Array<{role: string}>;
    };
    expect(body.systemInstruction).toEqual({parts: [{text: 'Be brief.'}]});
    expect(body.contents.map(content => content.role)).toEqual([
      'user',
      'model',
      'user',
    ]);
  });

  it('skips thoughts and reports a cut-off answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse([
          {
            candidates: [
              {content: {parts: [{text: 'thinking', thought: true}]}},
            ],
          },
          textChunk('Answer', 'MAX_TOKENS'),
        ]),
      ),
    );
    const pieces: string[] = [];

    await expect(ask(text => pieces.push(text))).resolves.toBe('truncated');
    expect(pieces).toEqual(['Answer']);
  });

  it('reports a safety stop as refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sse([textChunk('', 'SAFETY')])),
    );

    await expect(ask()).resolves.toBe('refused');
  });

  it.each([
    [
      400,
      'INVALID_ARGUMENT',
      'API key not valid. Please pass a valid API key.',
      'auth',
    ],
    [403, 'PERMISSION_DENIED', 'Denied', 'permission'],
    [404, 'NOT_FOUND', 'models/x is not found', 'model'],
    [
      429,
      'RESOURCE_EXHAUSTED',
      'You exceeded your current quota, check billing.',
      'quota',
    ],
    [429, 'RESOURCE_EXHAUSTED', 'Too many requests', 'rate-limit'],
    [500, 'INTERNAL', 'Oops', 'other'],
  ])(
    'classifies a %i %s as an error the UI explains',
    async (code, status, message, kind) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({error: {code, message, status}}), {
            status: code,
          }),
        ),
      );

      const failure = ask();

      await expect(failure).rejects.toBeInstanceOf(AiError);
      await expect(failure).rejects.toMatchObject({kind});
    },
  );

  it('reports a failed network request as a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    await expect(ask()).rejects.toMatchObject({kind: 'network'});
  });
});

describe('GEMINI_PROVIDER.listModels', () => {
  it('keeps only Gemini chat models, across pages, newest first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-embedding-001',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
          nextPageToken: 'next',
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          models: [
            {
              name: 'models/gemini-3.8-flash',
              displayName: 'Gemini 3.8 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemma-3-27b-it',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const models = await GEMINI_PROVIDER.listModels('AIzaSyTestKey');

    expect(models.map(model => model.id)).toEqual([
      'gemini-3.8-flash',
      'gemini-2.5-flash',
    ]);
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=next');
  });
});

describe('modelDisplayName for Gemini', () => {
  it('capitalizes the words of the model ID', () => {
    expect(modelDisplayName('gemini-flash-latest')).toBe('Gemini Flash Latest');
    expect(modelDisplayName('gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
  });
});
