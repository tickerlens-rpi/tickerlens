import {useId, useRef, useState} from 'react';
import type {FormEvent, ReactNode} from 'react';
import {AiError, describeAiError, listModels} from '../lib/ai/chat';
import type {ModelOption} from '../lib/ai/chat';
import {
  AI_PROVIDERS,
  PROVIDERS,
  checkApiKey,
  codexModelsFor,
  describeAccount,
  forgetConnection,
  modelDisplayName,
  saveConnection,
} from '../lib/ai/connection';
import type {
  AiConnection,
  AiProvider,
  ApiKeyProvider,
  CodexTokens,
  KeyProblem,
  Persistence,
} from '../lib/ai/connection';
import {CodexSignIn} from './codex_sign_in';

type FormStatus =
  | {kind: 'idle'}
  | {kind: 'checking'}
  | {kind: 'saved'; modelReplaced?: string}
  | {kind: 'forgotten'}
  | {kind: 'error'; message: string; keyProblem: boolean};

const KEY_PROBLEMS: Record<KeyProblem, (provider: ApiKeyProvider) => string> = {
  empty: () => 'Paste your API key first.',
  whitespace: () =>
    'The key contains spaces or line breaks. Copy it again without them.',
  'wrong-provider': provider => {
    if (provider === 'gemini') {
      return 'That looks like an OpenAI or Anthropic key, not a Google key.';
    }
    const {label, keyPrefix} = PROVIDERS[provider];
    const article = /^[AEIOU]/.test(label) ? 'an' : 'a';
    return `That does not look like ${article} ${label} key. ${label} keys start with “${keyPrefix}”.`;
  },
};

const PERSISTENCE_OPTIONS: ReadonlyArray<{
  value: Persistence;
  label: string;
  hint: string;
}> = [
  {
    value: 'device',
    label: 'Remember on this computer',
    hint: 'Best for your own computer. Stays until you remove it.',
  },
  {
    value: 'session',
    label: 'This tab only',
    hint: 'For shared or school computers. Forgotten when you close this tab.',
  },
];

/** Step-by-step help for getting a key from each provider. */
const KEY_STEPS: Record<ApiKeyProvider, ReactNode[]> = {
  anthropic: [
    <>
      Sign in at{' '}
      <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">
        console.anthropic.com
      </a>
      . This developer account is separate from the Claude chat app, but you can
      use the same email.
    </>,
    <>
      Open <strong>Billing</strong> and add a small amount of credit, for
      example $5. API use is prepaid.
    </>,
    <>
      Open <strong>API keys</strong>, choose <strong>Create key</strong> and
      name it “TickerLens”.
    </>,
    <>Copy the key and paste it below. It is only shown once.</>,
  ],
  openai: [
    <>
      Sign in at{' '}
      <a href="https://platform.openai.com" target="_blank" rel="noreferrer">
        platform.openai.com
      </a>
      . This developer account is separate from the ChatGPT app, but you can use
      the same login.
    </>,
    <>
      Open <strong>Settings → Billing</strong> and add a small amount of credit,
      for example $5. API use is prepaid.
    </>,
    <>
      Open <strong>API keys</strong>, choose{' '}
      <strong>Create new secret key</strong> and name it “TickerLens”.
    </>,
    <>Copy the key and paste it below. It is only shown once.</>,
  ],
  gemini: [
    <>
      Sign in at{' '}
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noreferrer"
      >
        aistudio.google.com
      </a>{' '}
      with your Google account. This is separate from the Gemini app.
    </>,
    <>
      Choose <strong>Create API key</strong>. Google lets you use it free up to
      a daily limit; to go beyond that, set up billing in Google AI Studio.
    </>,
    <>Copy the key and paste it below.</>,
  ],
};

interface AiConnectionFormProps {
  connection?: AiConnection;
  /** Shown after a successful save, for example a link onward. */
  savedAction?: ReactNode;
}

/**
 * Lets the user connect their own Claude, ChatGPT or Gemini API key, or sign in with
 * a ChatGPT plan. A key is checked by calling the provider directly from the
 * browser (listing models, which costs nothing); either way the connection
 * is saved in this browser only.
 */
export function AiConnectionForm({
  connection,
  savedAction,
}: AiConnectionFormProps) {
  const keyId = useId();
  const keyHintId = useId();
  const modelId = useId();
  const statusId = useId();
  const [provider, setProvider] = useState<AiProvider>(
    connection?.provider ?? 'anthropic',
  );
  const [apiKey, setApiKey] = useState(
    connection && connection.provider !== 'codex' ? connection.apiKey : '',
  );
  const [model, setModel] = useState(
    connection?.model ?? PROVIDERS.anthropic.defaultModel,
  );
  const [persistence, setPersistence] = useState<Persistence>(
    connection?.persistence ?? 'device',
  );
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [status, setStatus] = useState<FormStatus>({kind: 'idle'});
  const abortRef = useRef<AbortController | undefined>(undefined);
  const keyRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const info = PROVIDERS[provider];
  const checking = status.kind === 'checking';
  const keyInvalid = status.kind === 'error' && status.keyProblem;

  function chooseProvider(next: AiProvider) {
    if (next === provider) {
      return;
    }
    abortRef.current?.abort();
    setProvider(next);
    setModel(
      connection?.provider === next
        ? connection.model
        : PROVIDERS[next].defaultModel,
    );
    setModels([]);
    setStatus({kind: 'idle'});
    // Keep the key only if it belongs to the newly chosen provider.
    if (next === 'codex' || checkApiKey(next, apiKey.trim()) !== undefined) {
      setApiKey('');
    }
  }

  function handleSignedIn(tokens: CodexTokens) {
    const allowed = codexModelsFor(tokens.plan);
    let chosen = model.trim() || PROVIDERS.codex.defaultModel;
    let modelReplaced: string | undefined;
    if (!allowed.includes(chosen)) {
      modelReplaced = chosen;
      chosen = PROVIDERS.codex.defaultModel;
    }
    const saved = saveConnection({
      provider: 'codex',
      tokens,
      model: chosen,
      persistence,
    });
    if (!saved) {
      fail(
        'Your browser would not let TickerLens save the sign-in. Storage may be full or blocked by privacy settings.',
        false,
      );
      return;
    }
    setModel(chosen);
    setStatus({kind: 'saved', modelReplaced});
  }

  function fail(message: string, keyProblem: boolean) {
    setStatus({kind: 'error', message, keyProblem});
    if (keyProblem) {
      keyRef.current?.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking) {
      return;
    }
    if (provider === 'codex') {
      // Signing in happens in CodexSignIn; here only settings change.
      if (connection?.provider === 'codex') {
        const allowed = codexModelsFor(connection.tokens.plan);
        const chosen = allowed.includes(model) ? model : connection.model;
        saveConnection({...connection, model: chosen, persistence});
        setModel(chosen);
        setStatus({kind: 'saved'});
      }
      return;
    }
    const key = apiKey.trim();
    const problem = checkApiKey(provider, key);
    if (problem) {
      fail(KEY_PROBLEMS[problem](provider), true);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({kind: 'checking'});
    try {
      const available = await listModels(provider, key, controller.signal);
      let chosen = model.trim() || info.defaultModel;
      let modelReplaced: string | undefined;
      if (available.length > 0 && !available.some(m => m.id === chosen)) {
        modelReplaced = chosen;
        chosen = available[0].id;
      }
      const saved = saveConnection({
        provider,
        apiKey: key,
        model: chosen,
        persistence,
      });
      if (!saved) {
        fail(
          'Your browser would not let TickerLens save the key. Storage may be full or blocked by privacy settings.',
          false,
        );
        return;
      }
      setApiKey(key);
      setModel(chosen);
      setModels(available);
      setStatus({kind: 'saved', modelReplaced});
    } catch (error) {
      if (!controller.signal.aborted) {
        const keyProblem =
          error instanceof AiError &&
          (error.kind === 'auth' || error.kind === 'permission');
        fail(describeAiError(error, provider), keyProblem);
      }
    }
  }

  function handleForget() {
    abortRef.current?.abort();
    forgetConnection();
    setApiKey('');
    setModels([]);
    setShowKey(false);
    setStatus({kind: 'forgotten'});
    // The button that had focus is about to disappear; keep focus nearby.
    statusRef.current?.focus();
  }

  const connected = connection !== undefined && status.kind !== 'forgotten';
  const codexConnected = connected && connection?.provider === 'codex';
  const codexModels = codexModelsFor(
    connection?.provider === 'codex' ? connection.tokens.plan : 'pro',
  );

  return (
    <form className="settings-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="field">
        <legend className="field__label">Which AI do you use?</legend>
        <div className="provider-options">
          {AI_PROVIDERS.map(option => (
            <label key={option} className="provider-option">
              <input
                type="radio"
                name="provider"
                value={option}
                checked={provider === option}
                onChange={() => chooseProvider(option)}
              />
              <span className="provider-option__name">
                {PROVIDERS[option].product}
              </span>
              <span className="provider-option__by">
                by {PROVIDERS[option].label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {provider === 'codex' ? (
        !codexConnected && <CodexSignIn onSignedIn={handleSignedIn} />
      ) : (
        <>
          <details className="key-help" open={!connection}>
            <summary>How do I get a key? (about 3 minutes)</summary>
            <ol className="key-help__steps">
              {KEY_STEPS[provider].map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <p className="key-help__tip">
              <strong>Tip:</strong> set a monthly spending limit on the{' '}
              <a href={info.billingUrl} target="_blank" rel="noreferrer">
                {info.label} billing page
              </a>{' '}
              so you are never charged more than you expect.
            </p>
          </details>

          <div className="field">
            <label className="field__label" htmlFor={keyId}>
              {info.label} API key
            </label>
            <div className="key-input">
              <input
                id={keyId}
                ref={keyRef}
                className="text-input text-input--mono"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder={info.keyPlaceholder}
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                aria-invalid={keyInvalid}
                aria-describedby={
                  keyInvalid ? `${statusId} ${keyHintId}` : keyHintId
                }
              />
              <button
                type="button"
                className="button"
                aria-pressed={showKey}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="field__hint" id={keyHintId}>
              You pay {info.label} directly for what you use, {info.costHint}{' '}
              with the default model. This is separate from any{' '}
              {info.chatAccount}.
            </p>
          </div>
        </>
      )}

      <fieldset className="field">
        <legend className="field__label">
          {provider === 'codex'
            ? 'Where to keep your sign-in'
            : 'Where to keep the key'}
        </legend>
        {PERSISTENCE_OPTIONS.map(option => (
          <label key={option.value} className="radio-row">
            <input
              type="radio"
              name="persistence"
              value={option.value}
              checked={persistence === option.value}
              onChange={() => setPersistence(option.value)}
            />
            <span>
              <span className="radio-row__label">{option.label}</span>
              <span className="radio-row__hint">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <details className="advanced">
        <summary>Advanced (optional)</summary>
        <div className="field">
          <label className="field__label" htmlFor={modelId}>
            AI model
          </label>
          {provider === 'codex' ? (
            <select
              id={modelId}
              className="text-input"
              value={model}
              onChange={event => setModel(event.target.value)}
            >
              {codexModels.map(id => (
                <option key={id} value={id}>
                  {modelDisplayName(id)}
                </option>
              ))}
            </select>
          ) : models.length > 0 ? (
            <select
              id={modelId}
              className="text-input"
              value={model}
              onChange={event => setModel(event.target.value)}
            >
              {models.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label === option.id
                    ? modelDisplayName(option.id)
                    : option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={modelId}
              className="text-input text-input--mono"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={model}
              onChange={event => setModel(event.target.value)}
            />
          )}
          <p className="field__hint">
            Which version of {info.product} answers your questions. The default,{' '}
            {modelDisplayName(info.defaultModel)}, is a good balance of quality
            and cost; you do not need to change it.
            {provider !== 'codex' &&
              models.length === 0 &&
              ' After you verify your key you can pick from the models it can use.'}
          </p>
        </div>
      </details>

      <div className="settings-form__actions">
        {(provider !== 'codex' || codexConnected) && (
          <button
            type="submit"
            className="button button--primary"
            aria-disabled={checking}
          >
            {checking ? 'Checking…' : connected ? 'Save changes' : 'Connect'}
          </button>
        )}
        {connected && (
          <button type="button" className="button" onClick={handleForget}>
            {connection?.provider === 'codex'
              ? 'Sign out and forget'
              : 'Disconnect and forget key'}
          </button>
        )}
      </div>

      <div className="settings-form__result">
        <p
          id={statusId}
          ref={statusRef}
          tabIndex={-1}
          className={`settings-form__status settings-form__status--${statusTone(status, connected)}`}
          role="status"
          aria-live="polite"
        >
          {status.kind === 'idle' && (
            <span className="status-dot" aria-hidden="true" />
          )}
          {statusMessage(status, connection)}
        </p>
        {status.kind === 'saved' && savedAction}
      </div>
    </form>
  );
}

function statusTone(status: FormStatus, connected: boolean): string {
  if (status.kind === 'idle') {
    return connected ? 'connected' : 'idle';
  }
  return status.kind;
}

function statusMessage(
  status: FormStatus,
  connection: AiConnection | undefined,
): string {
  switch (status.kind) {
    case 'idle':
      return connection
        ? `Connected to ${PROVIDERS[connection.provider].product} (${modelDisplayName(connection.model)}) with ${describeAccount(connection)}.`
        : 'Not connected yet.';
    case 'checking':
      return 'Checking your key with the provider…';
    case 'saved': {
      const replaced =
        status.modelReplaced && connection
          ? ` ${modelDisplayName(status.modelReplaced)} is not available to this key, so ${modelDisplayName(connection.model)} was chosen instead.`
          : '';
      const where =
        connection?.persistence === 'session'
          ? 'kept in this tab only'
          : 'saved on this computer';
      return connection?.provider === 'codex'
        ? `Signed in as ${describeAccount(connection)}. Your sign-in is ${where}.${replaced}`
        : `Connected. Your key works and is ${where}.${replaced}`;
    }
    case 'forgotten':
      return 'Disconnected. Your key or sign-in has been deleted from this computer.';
    case 'error':
      return status.message;
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
