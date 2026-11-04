/**
 * @fileoverview The user's own AI connection: provider, API key and model.
 *
 * The connection is stored only in this browser, on the user's computer.
 * Requests made with it go straight from the browser to the provider
 * (api.anthropic.com or api.openai.com); TickerLens servers never see the key.
 * In production builds a Content-Security-Policy (see `vite.config.ts`) stops
 * the page from sending requests anywhere else.
 */

import {STORAGE_PREFIX, readJson, removeKey, writeJson} from '../local_data';

export const AI_PROVIDERS = ['anthropic', 'openai'] as const;

/** Which company's API the user connected. */
export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * Where the connection is kept. `device` survives restarts (localStorage);
 * `session` is forgotten when the tab closes (sessionStorage).
 */
export type Persistence = 'device' | 'session';

export interface AiConnection {
  provider: AiProvider;
  apiKey: string;
  model: string;
  persistence: Persistence;
}

export const AI_CONNECTION_KEY = `${STORAGE_PREFIX}aiConnection`;

/** Display details for each provider. */
export interface ProviderInfo {
  label: string;
  product: string;
  keyPrefix: string;
  keyPlaceholder: string;
  keysUrl: string;
  billingUrl: string;
  /** The developer site where keys and API credit are managed. */
  consoleHost: string;
  /** What the user's existing chat account is called, to contrast with it. */
  chatAccount: string;
  defaultModel: string;
  /** Rough cost of one question with the default model, in plain words. */
  costHint: string;
}

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  anthropic: {
    label: 'Anthropic',
    product: 'Claude',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-…',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    billingUrl: 'https://console.anthropic.com/settings/billing',
    consoleHost: 'console.anthropic.com',
    chatAccount: 'Claude Pro or Max plan',
    defaultModel: 'claude-opus-5-5',
    costHint: 'usually 2 to 10 cents per question',
  },
  openai: {
    label: 'OpenAI',
    product: 'ChatGPT',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-…',
    keysUrl: 'https://platform.openai.com/api-keys',
    billingUrl: 'https://platform.openai.com/settings/organization/billing',
    consoleHost: 'platform.openai.com',
    chatAccount: 'ChatGPT Plus or Pro plan',
    defaultModel: 'gpt-5',
    costHint: 'usually a few cents per question',
  },
};

const MODEL_WORDS: Record<string, string> = {
  gpt: 'GPT',
  chatgpt: 'ChatGPT',
  mini: 'mini',
  nano: 'nano',
};

/**
 * Turns a model ID into something a person can read:
 * `claude-opus-5-5` → `Claude Opus 5.5`, `gpt-5-mini` → `GPT-5 mini`.
 */
export function modelDisplayName(id: string): string {
  const claude = /^claude-([a-z]+)-(\d+)(?:-(\d+))?$/.exec(id);
  if (claude) {
    const [, family, major, minor] = claude;
    const name = family.charAt(0).toUpperCase() + family.slice(1);
    return `Claude ${name} ${minor ? `${major}.${minor}` : major}`;
  }
  const gpt = /^(gpt|chatgpt)-([\d.o]+)(?:-(.*))?$/.exec(id);
  if (gpt) {
    const [, brand, version, rest] = gpt;
    const suffix = rest
      ? ` ${rest
          .split('-')
          .map(word => MODEL_WORDS[word] ?? word)
          .join(' ')}`
      : '';
    return `${MODEL_WORDS[brand]}-${version}${suffix}`;
  }
  return id;
}

/** Type guard for provider names read from storage. */
export function isAiProvider(value: unknown): value is AiProvider {
  return AI_PROVIDERS.some(provider => provider === value);
}

/** Validates a value read from storage. */
export function isAiConnection(value: unknown): value is AiConnection {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // Safe: `value` is a non-null object, and every field is checked below.
  const record = value as Record<string, unknown>;
  return (
    isAiProvider(record.provider) &&
    typeof record.apiKey === 'string' &&
    record.apiKey !== '' &&
    typeof record.model === 'string' &&
    record.model !== '' &&
    (record.persistence === 'device' || record.persistence === 'session')
  );
}

/** Why a key typed into the settings form cannot be used. */
export type KeyProblem = 'empty' | 'whitespace' | 'wrong-provider';

/** Checks the shape of an API key before anything is sent anywhere. */
export function checkApiKey(
  provider: AiProvider,
  apiKey: string,
): KeyProblem | undefined {
  if (apiKey === '') {
    return 'empty';
  }
  if (/\s/.test(apiKey)) {
    return 'whitespace';
  }
  if (
    provider === 'openai' &&
    apiKey.startsWith(PROVIDERS.anthropic.keyPrefix)
  ) {
    return 'wrong-provider';
  }
  if (!apiKey.startsWith(PROVIDERS[provider].keyPrefix)) {
    return 'wrong-provider';
  }
  return undefined;
}

/** Shows only the start and end of a key, e.g. `sk-ant-…9fQa`. */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return '•'.repeat(apiKey.length);
  }
  const prefix = apiKey.startsWith('sk-ant-') ? 'sk-ant-' : apiKey.slice(0, 3);
  return `${prefix}…${apiKey.slice(-4)}`;
}

interface ConnectionStorages {
  device: Storage;
  session: Storage;
}

function defaultStorages(): ConnectionStorages {
  return {device: localStorage, session: sessionStorage};
}

/** Reads the saved connection, checking the tab-only copy first. */
export function readConnection(
  storages: ConnectionStorages = defaultStorages(),
): AiConnection | undefined {
  for (const storage of [storages.session, storages.device]) {
    const value = readJson(AI_CONNECTION_KEY, storage);
    if (isAiConnection(value)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Saves the connection in the storage its `persistence` asks for and removes
 * any copy from the other one, so a key never lingers where the user did not
 * choose to keep it.
 */
export function saveConnection(
  connection: AiConnection,
  storages: ConnectionStorages = defaultStorages(),
): boolean {
  const keep =
    connection.persistence === 'device' ? storages.device : storages.session;
  const drop =
    connection.persistence === 'device' ? storages.session : storages.device;
  removeKey(AI_CONNECTION_KEY, drop);
  return writeJson(AI_CONNECTION_KEY, connection, keep);
}

/** Forgets the connection everywhere. */
export function forgetConnection(
  storages: ConnectionStorages = defaultStorages(),
): void {
  removeKey(AI_CONNECTION_KEY, storages.device);
  removeKey(AI_CONNECTION_KEY, storages.session);
}
