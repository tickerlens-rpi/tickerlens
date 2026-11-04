import {useId, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {describeAiError, listModels} from '../lib/ai/chat';
import type {ModelOption} from '../lib/ai/chat';
import {
  AI_PROVIDERS,
  PROVIDERS,
  checkApiKey,
  forgetConnection,
  maskApiKey,
  saveConnection,
} from '../lib/ai/connection';
import type {
  AiConnection,
  AiProvider,
  KeyProblem,
  Persistence,
} from '../lib/ai/connection';

type FormStatus =
  | {kind: 'idle'}
  | {kind: 'checking'}
  | {kind: 'saved'; modelCount: number; modelReplaced?: string}
  | {kind: 'forgotten'}
  | {kind: 'error'; message: string};

const KEY_PROBLEMS: Record<KeyProblem, (provider: AiProvider) => string> = {
  empty: () => 'Paste your API key first.',
  whitespace: () =>
    'The key contains spaces or line breaks. Copy it again without them.',
  'wrong-provider': provider =>
    `That does not look like an ${PROVIDERS[provider].label} key. ${PROVIDERS[provider].label} keys start with “${PROVIDERS[provider].keyPrefix}”.`,
};

const PERSISTENCE_OPTIONS: ReadonlyArray<{
  value: Persistence;
  label: string;
  hint: string;
}> = [
  {
    value: 'device',
    label: 'Remember on this computer',
    hint: 'Saved in this browser’s local storage until you remove it.',
  },
  {
    value: 'session',
    label: 'This tab only',
    hint: 'Forgotten as soon as you close this tab.',
  },
];

interface AiConnectionFormProps {
  connection?: AiConnection;
}

/**
 * Lets the user connect their own Claude or ChatGPT API key. The key is
 * checked by calling the provider directly from the browser (listing models,
 * which costs nothing) and then saved in this browser only.
 */
export function AiConnectionForm({connection}: AiConnectionFormProps) {
  const keyId = useId();
  const keyHintId = useId();
  const modelId = useId();
  const modelListId = useId();
  const statusId = useId();
  const [provider, setProvider] = useState<AiProvider>(
    connection?.provider ?? 'anthropic',
  );
  const [apiKey, setApiKey] = useState(connection?.apiKey ?? '');
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
  const info = PROVIDERS[provider];
  const checking = status.kind === 'checking';

  function chooseProvider(next: AiProvider) {
    if (next === provider) {
      return;
    }
    abortRef.current?.abort();
    setProvider(next);
    setModel(PROVIDERS[next].defaultModel);
    setModels([]);
    setStatus({kind: 'idle'});
    // Keep the key only if it belongs to the newly chosen provider.
    if (checkApiKey(next, apiKey.trim()) !== undefined) {
      setApiKey('');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = apiKey.trim();
    const problem = checkApiKey(provider, key);
    if (problem) {
      setStatus({kind: 'error', message: KEY_PROBLEMS[problem](provider)});
      return;
    }

    abortRef.current?.abort();
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
        setStatus({
          kind: 'error',
          message:
            'Your browser would not let TickerLens save the key. Storage may be full or blocked by privacy settings.',
        });
        return;
      }
      setApiKey(key);
      setModel(chosen);
      setModels(available);
      setStatus({kind: 'saved', modelCount: available.length, modelReplaced});
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus({kind: 'error', message: describeAiError(error)});
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
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="field">
        <legend className="field__label">AI provider</legend>
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

      <div className="field">
        <label className="field__label" htmlFor={keyId}>
          {info.label} API key
        </label>
        <div className="key-input">
          <input
            id={keyId}
            className="text-input text-input--mono"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder={info.keyPlaceholder}
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            aria-describedby={keyHintId}
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
          Create one at{' '}
          <a href={info.keysUrl} target="_blank" rel="noreferrer">
            {new URL(info.keysUrl).host}
          </a>
          . API use is billed by {info.label} to your account, separately from
          any {info.product} subscription.
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={modelId}>
          Model
        </label>
        <input
          id={modelId}
          className="text-input text-input--mono"
          type="text"
          autoComplete="off"
          spellCheck={false}
          list={modelListId}
          value={model}
          onChange={event => setModel(event.target.value)}
        />
        <datalist id={modelListId}>
          {models.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </datalist>
        <p className="field__hint">
          {models.length > 0
            ? `${models.length} models available to your key. Start typing to pick one.`
            : 'Your key’s models load after you verify it.'}
        </p>
      </div>

      <fieldset className="field">
        <legend className="field__label">Where to keep the key</legend>
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

      <div className="settings-form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={checking}
          aria-describedby={statusId}
        >
          {checking ? 'Checking…' : 'Verify and save'}
        </button>
        {connection && (
          <button type="button" className="button" onClick={handleForget}>
            Disconnect and forget key
          </button>
        )}
      </div>

      <p
        id={statusId}
        className={`settings-form__status settings-form__status--${status.kind}`}
        role="status"
        aria-live="polite"
      >
        {statusMessage(status, connection)}
      </p>
    </form>
  );
}

function statusMessage(
  status: FormStatus,
  connection: AiConnection | undefined,
): string {
  switch (status.kind) {
    case 'idle':
      return connection
        ? `Connected to ${PROVIDERS[connection.provider].product} with key ${maskApiKey(connection.apiKey)}.`
        : 'Not connected.';
    case 'checking':
      return 'Checking the key with the provider…';
    case 'saved': {
      const replaced = status.modelReplaced
        ? ` “${status.modelReplaced}” is not available to this key, so ${connection?.model ?? 'another model'} was selected instead.`
        : '';
      return `Key verified and saved in this browser.${replaced}`;
    }
    case 'forgotten':
      return 'Disconnected. The key has been deleted from this browser.';
    case 'error':
      return status.message;
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
