/**
 * @fileoverview ChatGPT models, called from the browser with the user's own
 * key. See `anthropic_provider.ts` for why browser use is acceptable here.
 */

import OpenAI from 'openai';
import {AiError, apiKeyOf} from './chat';
import type {
  ChatEnding,
  ChatRequest,
  ModelOption,
  KeyProviderClient,
} from './chat';

/** Model families that are not text chat models. */
const NON_CHAT_MODEL =
  /audio|realtime|transcribe|tts|image|embedding|moderation|search|whisper|dall-e|davinci|babbage|codex/i;

/** Chat model families worth showing in the picker. */
const CHAT_MODEL = /^(gpt-|o\d|chatgpt-)/i;

function createClient(apiKey: string): OpenAI {
  return new OpenAI({apiKey, dangerouslyAllowBrowser: true});
}

function toAiError(error: unknown): AiError {
  if (error instanceof OpenAI.APIUserAbortError) {
    return new AiError('aborted', 'Request was stopped.');
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new AiError('auth', error.message);
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    return new AiError('permission', error.message);
  }
  if (error instanceof OpenAI.NotFoundError) {
    return new AiError('model', error.message);
  }
  if (error instanceof OpenAI.RateLimitError) {
    // OpenAI reports an empty balance as a 429 with this code.
    return error.code === 'insufficient_quota'
      ? new AiError('quota', error.message)
      : new AiError('rate-limit', error.message);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new AiError('network', error.message);
  }
  if (error instanceof OpenAI.APIError) {
    return new AiError('other', error.message);
  }
  if (error instanceof Error) {
    return new AiError('other', error.message);
  }
  return new AiError('other', 'Unknown error');
}

async function streamChat({
  connection,
  system,
  messages,
  onText,
  signal,
}: ChatRequest): Promise<ChatEnding> {
  const client = createClient(apiKeyOf(connection));
  try {
    const stream = await client.chat.completions.create(
      {
        model: connection.model,
        stream: true,
        messages: [{role: 'system', content: system}, ...messages],
      },
      {signal},
    );
    let ending: ChatEnding = 'complete';
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) {
        continue;
      }
      if (choice.delta.content) {
        onText(choice.delta.content);
      }
      if (choice.delta.refusal) {
        onText(choice.delta.refusal);
        ending = 'refused';
      }
      if (choice.finish_reason === 'length') {
        ending = 'truncated';
      } else if (choice.finish_reason === 'content_filter') {
        ending = 'refused';
      }
    }
    return ending;
  } catch (error) {
    throw toAiError(error);
  }
}

async function listModels(
  apiKey: string,
  signal?: AbortSignal,
): Promise<ModelOption[]> {
  const client = createClient(apiKey);
  try {
    const models: Array<{id: string; created: number}> = [];
    for await (const model of client.models.list({signal})) {
      if (CHAT_MODEL.test(model.id) && !NON_CHAT_MODEL.test(model.id)) {
        models.push({id: model.id, created: model.created});
      }
    }
    // Newest first, so the most capable current models lead the list.
    models.sort((a, b) => b.created - a.created);
    return models.map(model => ({id: model.id, label: model.id}));
  } catch (error) {
    throw toAiError(error);
  }
}

/** OpenAI implementation of the provider interface. */
export const OPENAI_PROVIDER: KeyProviderClient = {streamChat, listModels};
