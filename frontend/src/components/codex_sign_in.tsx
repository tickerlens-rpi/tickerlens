import {useEffect, useRef, useState} from 'react';
import {
  CODEX_DEVICE_PAGE,
  CodexSignInError,
  requestDeviceCode,
  waitForDeviceApproval,
} from '../lib/ai/codex_auth';
import type {DeviceCode} from '../lib/ai/codex_auth';
import {CODEX_RELAY_URL} from '../lib/ai/connection';
import type {CodexTokens} from '../lib/ai/connection';

interface CodexSignInProps {
  /** Runs with the tokens once the user approves the sign-in. */
  onSignedIn: (tokens: CodexTokens) => void;
  /** The relay the requests will use; tests pass their own. */
  relayUrl?: string;
}

type SignInState =
  | {kind: 'idle'}
  | {kind: 'starting'}
  | {kind: 'waiting'; code: DeviceCode}
  | {kind: 'error'; message: string};

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Sign in with a ChatGPT plan by approving a short code at auth.openai.com,
 * the way OpenAI's Codex app signs in on devices without a browser. The page
 * checks every few seconds and finishes on its own once the code is approved.
 */
export function CodexSignIn({
  onSignedIn,
  relayUrl = CODEX_RELAY_URL,
}: CodexSignInProps) {
  const [state, setState] = useState<SignInState>({kind: 'idle'});
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | undefined>(undefined);

  // Stop checking if the user leaves the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!relayUrl) {
    return (
      <p className="codex-sign-in__unavailable">
        Signing in with a ChatGPT plan only works on a TickerLens server, not on
        this preview site. Connect with an API key here instead.
      </p>
    );
  }

  async function start() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCopied(false);
    setState({kind: 'starting'});
    try {
      const code = await requestDeviceCode(undefined, controller.signal);
      setState({kind: 'waiting', code});
      const tokens = await waitForDeviceApproval(
        code,
        undefined,
        controller.signal,
      );
      setState({kind: 'idle'});
      onSignedIn(tokens);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setState({
        kind: 'error',
        message:
          error instanceof CodexSignInError
            ? error.message
            : 'Could not reach OpenAI to sign in. Check your internet connection and try again.',
      });
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setState({kind: 'idle'});
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  // The clipboard API only exists on HTTPS pages.
  const canCopy =
    typeof navigator !== 'undefined' && navigator.clipboard !== undefined;

  return (
    <div className="codex-sign-in">
      <ul className="codex-sign-in__facts">
        <li>
          Uses the same sign-in as OpenAI’s Codex app. Answers count toward your
          plan’s Codex usage limits; there is no API key or billing to set up.
        </li>
        <li>
          Your sign-in is kept in this browser. Requests pass through the
          TickerLens server on their way to chatgpt.com, which keeps nothing.
        </li>
        <li>
          <strong>Unofficial:</strong> OpenAI does not offer this for other
          websites and could stop it at any time.
        </li>
      </ul>

      {state.kind === 'waiting' ? (
        <div className="codex-sign-in__steps">
          <ol>
            <li>
              Open{' '}
              <a href={CODEX_DEVICE_PAGE} target="_blank" rel="noreferrer">
                auth.openai.com/codex/device
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>{' '}
              and sign in with your ChatGPT account if asked.
            </li>
            <li>
              Enter this code:{' '}
              <code className="codex-sign-in__code">{state.code.userCode}</code>
              {canCopy && (
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => void copy(state.code.userCode)}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </li>
            <li>Come back here. TickerLens finishes on its own.</li>
          </ol>
          <p className="codex-sign-in__waiting" role="status">
            Waiting for you to approve the code. It works until{' '}
            {TIME.format(state.code.expiresAt)}.
          </p>
          <button type="button" className="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button button--primary"
          aria-disabled={state.kind === 'starting'}
          onClick={() => {
            if (state.kind !== 'starting') {
              void start();
            }
          }}
        >
          {state.kind === 'starting'
            ? 'Asking OpenAI for a code…'
            : 'Sign in with ChatGPT'}
        </button>
      )}

      {state.kind === 'error' && (
        <p className="codex-sign-in__error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
