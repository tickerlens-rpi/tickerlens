/**
 * @fileoverview The user's own AI connection: an API key, or a ChatGPT plan
 * signed in the way OpenAI's Codex app signs in.
 *
 * The connection is stored only in this browser, on the user's computer.
 * API-key requests go straight from the browser to the provider
 * (api.anthropic.com or api.openai.com); TickerLens servers never see the
 * key. ChatGPT-plan requests pass through the TickerLens server on their way
 * to chatgpt.com, because chatgpt.com does not accept them from other sites;
 * the server forwards them without storing anything (see `codex_provider.ts`).
 * In production builds a Content-Security-Policy (see `vite.config.ts`) stops
 * the page from sending requests anywhere else.
 */

import {STORAGE_PREFIX, readJson, removeKey, writeJson} from '../local_data';

export const AI_PROVIDERS = ['anthropic', 'openai', 'codex'] as const;

/**
 * How the user connected: an Anthropic or OpenAI API key, or `codex`, a
 * ChatGPT plan signed in through OpenAI's Codex sign-in.
 */
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** The providers connected with a pasted API key. */
export type ApiKeyProvider = Exclude<AiProvider, 'codex'>;

/**
 * Where the connection is kept. `device` survives restarts (localStorage);
 * `session` is forgotten when the tab closes (sessionStorage).
 */
export type Persistence = 'device' | 'session';

/** A connection made with a pasted Anthropic or OpenAI API key. */
export interface ApiKeyConnection {
  provider: ApiKeyProvider;
  apiKey: string;
  model: string;
  persistence: Persistence;
}

/** What a ChatGPT sign-in returns, kept so requests can be made later. */
export interface CodexTokens {
  accessToken: string;
  /** Used once to get new tokens; OpenAI replaces it each time. */
  refreshToken: string;
  idToken: string;
  /** The ChatGPT account the requests are billed to. */
  accountId: string;
  email?: string;
  /** ChatGPT plan, such as free, plus or pro. */
  plan?: string;
  /** When the access token stops working, in milliseconds since 1970. */
  expiresAt: number;
}

/** A connection made by signing in with a ChatGPT plan. */
export interface CodexConnection {
  provider: 'codex';
  tokens: CodexTokens;
  model: string;
  persistence: Persistence;
}

export type AiConnection = ApiKeyConnection | CodexConnection;

export const AI_CONNECTION_KEY = `${STORAGE_PREFIX}aiConnection`;

/**
 * Where the TickerLens server relays ChatGPT-plan requests to chatgpt.com.
 * The dev server always has the relay (see `vite.config.ts`); a production
 * build has it only when VITE_CODEX_RELAY_URL is set, as the Docker image
 * does. Static hosts such as Cloudflare Pages have no relay.
 */
export const CODEX_RELAY_URL: string | undefined =
  import.meta.env.VITE_CODEX_RELAY_URL?.trim() ||
  (import.meta.env.DEV ? '/ai-proxy/codex' : undefined);

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
  codex: {
    label: 'OpenAI',
    product: 'ChatGPT plan',
    keyPrefix: '',
    keyPlaceholder: '',
    keysUrl: 'https://chatgpt.com',
    billingUrl: 'https://chatgpt.com/#pricing',
    consoleHost: 'chatgpt.com',
    chatAccount: 'ChatGPT plan',
    defaultModel: 'gpt-6-luna',
    costHint: 'included in your ChatGPT plan, within its Codex usage limits',
  },
};

/**
 * Models a ChatGPT plan can use through Codex, best first. Every plan has
 * the free ones; paid plans have them all. OpenAI offers no way to list
 * them, so this follows the list CLIProxyAPI keeps.
 */
export const CODEX_MODELS: ReadonlyArray<{id: string; paidOnly: boolean}> = [
  {id: 'gpt-6.1-sol', paidOnly: true},
  {id: 'gpt-6-sol', paidOnly: true},
  {id: 'gpt-6.1-terra', paidOnly: false},
  {id: 'gpt-6-luna', paidOnly: false},
  {id: 'gpt-5.6-sol', paidOnly: true},
  {id: 'gpt-5.6-terra', paidOnly: false},
  {id: 'gpt-5.6-luna', paidOnly: false},
];

/** The Codex models the signed-in plan can use. */
export function codexModelsFor(plan: string | undefined): string[] {
  const free = plan === undefined || plan === 'free';
  return CODEX_MODELS.filter(model => !free || !model.paidOnly).map(
    model => model.id,
  );
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isCodexTokens(value: unknown): value is CodexTokens {
  return (
    isRecord(value) &&
    isFilledString(value.accessToken) &&
    isFilledString(value.refreshToken) &&
    typeof value.idToken === 'string' &&
    isFilledString(value.accountId) &&
    typeof value.expiresAt === 'number' &&
    (value.email === undefined || typeof value.email === 'string') &&
    (value.plan === undefined || typeof value.plan === 'string')
  );
}

/** Validates a value read from storage. */
export function isAiConnection(value: unknown): value is AiConnection {
  if (
    !isRecord(value) ||
    !isAiProvider(value.provider) ||
    !isFilledString(value.model) ||
    (value.persistence !== 'device' && value.persistence !== 'session')
  ) {
    return false;
  }
  return value.provider === 'codex'
    ? isCodexTokens(value.tokens)
    : isFilledString(value.apiKey);
}

/** Says which account a connection uses, without revealing secrets. */
export function describeAccount(connection: AiConnection): string {
  if (connection.provider !== 'codex') {
    return `key ${maskApiKey(connection.apiKey)}`;
  }
  const {email, plan} = connection.tokens;
  const planName = plan
    ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`
    : '';
  const who = email ?? 'your ChatGPT account';
  return planName ? `${who} (${planName} plan)` : who;
}

/** Why a key typed into the settings form cannot be used. */
export type KeyProblem = 'empty' | 'whitespace' | 'wrong-provider';

/** Checks the shape of an API key before anything is sent anywhere. */
export function checkApiKey(
  provider: ApiKeyProvider,
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
