/**
 * @fileoverview Provider-neutral chat API used by the research chat and the
 * news summary.
 *
 * Provider modules are loaded on demand, so the landing page does not
 * download them. The Anthropic and OpenAI SDKs, and the Gemini REST client,
 * run in the browser and call the provider directly with the user's own key; ChatGPT-plan requests go
 * through the TickerLens server's relay (see `codex_provider.ts`).
 */

import {PROVIDERS} from './connection';
import type {AiConnection, AiProvider, ApiKeyProvider} from './connection';

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
}

/** What the API-key providers add: listing the models a key can use. */
export interface KeyProviderClient extends ProviderClient {
  listModels(apiKey: string, signal?: AbortSignal): Promise<ModelOption[]>;
}

async function loadKeyProvider(
  provider: ApiKeyProvider,
): Promise<KeyProviderClient> {
  switch (provider) {
    case 'anthropic':
      return (await import('./anthropic_provider')).ANTHROPIC_PROVIDER;
    case 'openai':
      return (await import('./openai_provider')).OPENAI_PROVIDER;
    case 'gemini':
      return (await import('./gemini_provider')).GEMINI_PROVIDER;
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
}

async function loadProvider(provider: AiProvider): Promise<ProviderClient> {
  return provider === 'codex'
    ? (await import('./codex_provider')).CODEX_PROVIDER
    : loadKeyProvider(provider);
}

/** The API key of a key connection; a ChatGPT-plan connection has none. */
export function apiKeyOf(connection: AiConnection): string {
  if (connection.provider === 'codex') {
    throw new AiError('other', 'This connection has no API key.');
  }
  return connection.apiKey;
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
  provider: ApiKeyProvider,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ModelOption[]> {
  const client = await loadKeyProvider(provider);
  return client.listModels(apiKey, signal);
}

/** Advice for errors when the user signed in with a ChatGPT plan. */
const CODEX_ADVICE: Partial<Record<AiErrorKind, string>> = {
  auth: 'Your ChatGPT sign-in has expired or was signed out. Sign in again in Settings.',
  permission:
    'chatgpt.com refused the request. Your plan may not include Codex, or OpenAI may be blocking sign-ins from other sites. Try another model under “Advanced” in Settings, or connect with an API key.',
  quota:
    'You have used up your ChatGPT plan’s Codex allowance for now. It refills after a while; try again later, or connect an API key in Settings.',
  model:
    'This model is not available on your ChatGPT plan. Choose another under “Advanced” in Settings.',
  network:
    'Could not reach ChatGPT through the TickerLens server. Check your internet connection and try again.',
  other: 'ChatGPT had a problem answering. Try again in a moment.',
};

/** Plain-language advice for an error, shown under the chat or the form. */
export function describeAiError(error: unknown, provider?: AiProvider): string {
  if (provider === 'codex' && error instanceof AiError) {
    const advice = CODEX_ADVICE[error.kind];
    if (advice) {
      return error.kind === 'other'
        ? `${advice} (Details: ${error.message})`
        : advice;
    }
  }
  const info = provider ? PROVIDERS[provider] : undefined;
  const company = info?.label ?? 'The AI provider';
  if (!(error instanceof AiError)) {
    return error instanceof Error
      ? `Something went wrong: ${error.message}`
      : 'Something went wrong talking to the AI provider.';
  }
  switch (error.kind) {
    case 'auth':
      return `${company} did not accept this key. Check that you copied all of it and that it has not been deleted, then save it again.`;
    case 'permission':
      return `This key is not allowed to do that. Check the key's permissions${info ? ` at ${info.consoleHost}` : ''}, or create a new key.`;
    case 'quota':
      return info
        ? `Your ${info.label} account is out of API credit. Add credit at ${info.consoleHost}, then ask again. API credit is separate from any ${info.chatAccount}.`
        : 'Your account is out of API credit. Add credit on the provider’s billing page, then ask again.';
    case 'rate-limit':
      return 'Too many questions too quickly. Wait about a minute and try again.';
    case 'model':
      return 'The selected AI model is not available to this key. Choose another under “Advanced” in Settings.';
    case 'network':
      return `Could not reach ${info?.label ?? 'the AI provider'}. Check your internet connection, and that an ad blocker or privacy extension is not blocking it.`;
    case 'aborted':
      return 'Stopped.';
    case 'other':
      return `The AI service had a problem. Try again in a moment. (Details: ${error.message})`;
    default: {
      const unreachable: never = error.kind;
      return unreachable;
    }
  }
}
