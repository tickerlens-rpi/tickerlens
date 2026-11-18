/**
 * @fileoverview Gemini models, called from the browser with the user's own
 * key. See `anthropic_provider.ts` for why browser use is acceptable here.
 *
 * Google's REST API accepts browser requests directly, so this uses `fetch`
 * rather than an SDK. The key goes in the `x-goog-api-key` header, never in
 * the URL, so it does not end up in logs or browser history.
 */

import {AiError, apiKeyOf} from './chat';
import type {
  ChatEnding,
  ChatRequest,
  KeyProviderClient,
  ModelOption,
} from './chat';

export const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta';

/** Model families that are not text chat models. */
const NON_CHAT_MODEL =
  /embedding|aqa|imagen|veo|tts|image|audio|live|robotics|computer-use|learnlm|gemma/i;

interface GeminiErrorBody {
  error?: {code?: number; message?: string; status?: string};
}

interface GeminiPart {
  text?: string;
  /** Set on the model's own reasoning, which is not part of the answer. */
  thought?: boolean;
}

interface GeminiChunk {
  candidates?: Array<{
    content?: {parts?: GeminiPart[]};
    finishReason?: string;
  }>;
  promptFeedback?: {blockReason?: string};
}

interface GeminiModel {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

function headers(apiKey: string): Record<string, string> {
  return {'Content-Type': 'application/json', 'x-goog-api-key': apiKey};
}

/** Turns a failed response into an AiError the UI can explain. */
async function errorFromResponse(response: Response): Promise<AiError> {
  let message = `Gemini answered with status ${response.status}.`;
  let status = '';
  try {
    const body = (await response.json()) as GeminiErrorBody;
    message = body.error?.message ?? message;
    status = body.error?.status ?? '';
  } catch {
    // Not JSON; keep the generic message.
  }
  switch (response.status) {
    case 401:
      return new AiError('auth', message);
    case 400:
      // Google reports a bad key as a 400 with INVALID_ARGUMENT.
      return /api key/i.test(message)
        ? new AiError('auth', message)
        : new AiError('other', message);
    case 403:
      return new AiError('permission', message);
    case 404:
      return new AiError('model', message);
    case 429:
      return status === 'RESOURCE_EXHAUSTED' && /quota|billing/i.test(message)
        ? new AiError('quota', message)
        : new AiError('rate-limit', message);
    default:
      return new AiError('other', message);
  }
}

function toAiError(error: unknown, signal?: AbortSignal): AiError {
  if (error instanceof AiError) {
    return error;
  }
  if (signal?.aborted) {
    return new AiError('aborted', 'Request was stopped.');
  }
  if (error instanceof TypeError) {
    // fetch rejects with a TypeError when the network request fails.
    return new AiError('network', error.message);
  }
  if (error instanceof Error) {
    return new AiError('other', error.message);
  }
  return new AiError('other', 'Unknown error');
}

/** Reads `data:` lines from a server-sent event stream. */
async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, {stream: true});
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (line.startsWith('data:')) {
          yield line.slice(5).trim();
        }
      }
    }
    const rest = buffer.trim();
    if (rest.startsWith('data:')) {
      yield rest.slice(5).trim();
    }
  } finally {
    reader.releaseLock();
  }
}

/** Gemini calls the assistant `model`. */
function toContents(messages: ChatRequest['messages']) {
  return messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{text: message.content}],
  }));
}

async function streamChat({
  connection,
  system,
  messages,
  onText,
  signal,
}: ChatRequest): Promise<ChatEnding> {
  const apiKey = apiKeyOf(connection);
  const model = encodeURIComponent(connection.model);
  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({
          systemInstruction: {parts: [{text: system}]},
          contents: toContents(messages),
        }),
        signal,
      },
    );
    if (!response.ok || !response.body) {
      throw await errorFromResponse(response);
    }
    let ending: ChatEnding = 'complete';
    for await (const data of readEvents(response.body)) {
      if (data === '') {
        continue;
      }
      const chunk = JSON.parse(data) as GeminiChunk;
      if (chunk.promptFeedback?.blockReason) {
        ending = 'refused';
      }
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        if (part.text && !part.thought) {
          onText(part.text);
        }
      }
      switch (candidate?.finishReason) {
        case 'MAX_TOKENS':
          ending = 'truncated';
          break;
        case 'SAFETY':
        case 'RECITATION':
        case 'BLOCKLIST':
        case 'PROHIBITED_CONTENT':
        case 'SPII':
          ending = 'refused';
          break;
        default:
          break;
      }
    }
    return ending;
  } catch (error) {
    throw toAiError(error, signal);
  }
}

async function listModels(
  apiKey: string,
  signal?: AbortSignal,
): Promise<ModelOption[]> {
  try {
    const models: ModelOption[] = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({pageSize: '1000'});
      if (pageToken) {
        query.set('pageToken', pageToken);
      }
      const response = await fetch(`${GEMINI_API_BASE}/models?${query}`, {
        headers: headers(apiKey),
        signal,
      });
      if (!response.ok) {
        throw await errorFromResponse(response);
      }
      const page = (await response.json()) as {
        models?: GeminiModel[];
        nextPageToken?: string;
      };
      for (const model of page.models ?? []) {
        const id = model.name.replace(/^models\//, '');
        if (
          id.startsWith('gemini-') &&
          !NON_CHAT_MODEL.test(id) &&
          (model.supportedGenerationMethods ?? []).includes('generateContent')
        ) {
          models.push({id, label: model.displayName ?? id});
        }
      }
      pageToken = page.nextPageToken ?? '';
    } while (pageToken);
    // The `-latest` aliases first, then newest versions first.
    return models.sort((a, b) =>
      b.id.localeCompare(a.id, undefined, {numeric: true}),
    );
  } catch (error) {
    throw toAiError(error, signal);
  }
}

/** Gemini implementation of the provider interface. */
export const GEMINI_PROVIDER: KeyProviderClient = {streamChat, listModels};
