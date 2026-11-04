/**
 * @fileoverview Provider-neutral chat API used by the research page.
 *
 * Provider SDKs are loaded on demand, so the landing page does not download
 * them. Both SDKs run in the browser and call the provider directly with the
 * user's own key.
 */

import type {AiConnection, AiProvider} from './connection';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  connection: AiConnection;
  system: string;
  messages: ChatMessage[];
  /** Called with each new piece of text as it streams in. */
  onText: (text: string) => void;
  signal?: AbortSignal;
}

/** How a finished reply ended. */
export type ChatEnding = 'complete' | 'truncated' | 'refused';

export interface ModelOption {
  id: string;
  label: string;
}

/** Broad reasons a provider call can fail, each with its own advice. */
export type AiErrorKind =
  | 'auth'
  | 'permission'
  | 'quota'
  | 'rate-limit'
  | 'model'
  | 'network'
  | 'aborted'
  | 'other';

/** An error from a provider call, classified for the UI. */
export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
  }
}

/** What each provider module implements. */
export interface ProviderClient {
  streamChat(request: ChatRequest): Promise<ChatEnding>;
  listModels(apiKey: string, signal?: AbortSignal): Promise<ModelOption[]>;
}

async function loadProvider(provider: AiProvider): Promise<ProviderClient> {
  switch (provider) {
    case 'anthropic':
      return (await import('./anthropic_provider')).ANTHROPIC_PROVIDER;
    case 'openai':
      return (await import('./openai_provider')).OPENAI_PROVIDER;
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
}

/** Streams a reply from the connected model. */
export async function streamChat(request: ChatRequest): Promise<ChatEnding> {
  const client = await loadProvider(request.connection.provider);
  return client.streamChat(request);
}

/**
 * Lists the chat models the key can use. Doubles as a free connection test:
 * listing models costs nothing and fails fast on a bad key.
 */
export async function listModels(
  provider: AiProvider,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ModelOption[]> {
  const client = await loadProvider(provider);
  return client.listModels(apiKey, signal);
}

/** Plain-language advice for an error, shown under the chat or the form. */
export function describeAiError(error: unknown): string {
  if (!(error instanceof AiError)) {
    return error instanceof Error
      ? `Something went wrong: ${error.message}`
      : 'Something went wrong talking to the AI provider.';
  }
  switch (error.kind) {
    case 'auth':
      return 'The provider rejected this API key. Check that it was copied in full and has not been revoked, then save it again in Settings.';
    case 'permission':
      return 'This API key is not allowed to do that. Check the key’s permissions or project in your provider dashboard.';
    case 'quota':
      return 'Your provider account has no credit left for API use. Add credit in the provider’s billing page.';
    case 'rate-limit':
      return 'The provider is rate-limiting this key. Wait a moment and try again.';
    case 'model':
      return 'The selected model is not available to this key. Pick another model in Settings.';
    case 'network':
      return 'Could not reach the provider. Check your internet connection, and that an ad or privacy blocker is not blocking the provider’s API.';
    case 'aborted':
      return 'Stopped.';
    case 'other':
      return `The provider returned an error: ${error.message}`;
    default: {
      const unreachable: never = error.kind;
      return unreachable;
    }
  }
}
