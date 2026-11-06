/**
 * @fileoverview Claude, called from the browser with the user's own key.
 *
 * `dangerouslyAllowBrowser` makes the SDK send the header Anthropic requires
 * for direct browser access. The usual reason the SDK warns about this, a
 * site's own secret key leaking to visitors, does not apply: the key belongs
 * to the visitor and never leaves their machine except to go to Anthropic.
 */

import Anthropic from '@anthropic-ai/sdk';
import {AiError, apiKeyOf} from './chat';
import type {
  ChatEnding,
  ChatRequest,
  ModelOption,
  KeyProviderClient,
} from './chat';

/** Models that accept `output_config.effort`. */
const EFFORT_MODELS = new Set([
  'claude-fable-5-1',
  'claude-fable-5',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5-5',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-5-5',
]);

/**
 * Models that accept `fallbacks: 'default'`: if a safety classifier declines
 * a request, the API re-runs it on Anthropic's recommended fallback model.
 */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

function createClient(apiKey: string): Anthropic {
  return new Anthropic({apiKey, dangerouslyAllowBrowser: true});
}

function toAiError(error: unknown): AiError {
  if (error instanceof Anthropic.APIUserAbortError) {
    return new AiError('aborted', 'Request was stopped.');
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiError('auth', error.message);
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new AiError('permission', error.message);
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiError('model', error.message);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError('rate-limit', error.message);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError('network', error.message);
  }
  if (error instanceof Anthropic.BadRequestError) {
    // Anthropic reports an empty balance as a 400 rather than a 429.
    return /credit balance/i.test(error.message)
      ? new AiError('quota', error.message)
      : new AiError('other', error.message);
  }
  if (error instanceof Anthropic.APIError) {
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
  const {model} = connection;
  const useFallbacks = FALLBACK_MODELS.has(model);
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 16000,
        system,
        messages,
        ...(EFFORT_MODELS.has(model)
          ? {output_config: {effort: 'medium'}}
          : {}),
        ...(useFallbacks
          ? {
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default' as const,
            }
          : {}),
      },
      {signal},
    );
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        onText(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    switch (final.stop_reason) {
      case 'refusal':
        return 'refused';
      case 'max_tokens':
      case 'model_context_window_exceeded':
        return 'truncated';
      default:
        return 'complete';
    }
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
    const models: ModelOption[] = [];
    for await (const model of client.models.list({limit: 100}, {signal})) {
      models.push({id: model.id, label: model.display_name});
    }
    return models;
  } catch (error) {
    throw toAiError(error);
  }
}

/** Claude implementation of the provider interface. */
export const ANTHROPIC_PROVIDER: KeyProviderClient = {streamChat, listModels};
