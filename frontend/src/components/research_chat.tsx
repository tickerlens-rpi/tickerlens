import {useEffect, useId, useRef, useState} from 'react';
import type {FormEvent, KeyboardEvent} from 'react';
import {AiError, describeAiError, streamChat} from '../lib/ai/chat';
import type {ChatEnding, ChatMessage} from '../lib/ai/chat';
import {PROVIDERS, modelDisplayName} from '../lib/ai/connection';
import type {AiConnection} from '../lib/ai/connection';
import {
  STARTER_QUESTIONS,
  buildResearchSystemPrompt,
} from '../lib/research_prompt';
import {routeHref} from '../lib/router';
import {AiAnswer} from './ai_answer';

interface ResearchChatProps {
  ticker: string;
  connection: AiConnection;
  /** Focus the question box on mount, e.g. right after connecting. */
  autoFocus?: boolean;
}

type ChatStatus =
  | {kind: 'idle'}
  | {kind: 'streaming'}
  | {kind: 'ended'; ending: ChatEnding}
  | {kind: 'stopped'}
  | {kind: 'error'; message: string; quota: boolean};

const ENDING_NOTES: Record<ChatEnding, string> = {
  complete: '',
  truncated: 'This answer hit its length limit and was cut short.',
  refused: 'The AI declined to answer this one. Try asking it another way.',
};

/**
 * Chat about one ticker with the user's connected model. The conversation
 * lives in memory only and is gone when the page changes.
 */
export function ResearchChat({
  ticker,
  connection,
  autoFocus = false,
}: ResearchChatProps) {
  const inputId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<ChatStatus>({kind: 'idle'});
  const abortRef = useRef<AbortController | undefined>(undefined);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const streaming = status.kind === 'streaming';
  const provider = PROVIDERS[connection.provider];
  const modelName = modelDisplayName(connection.model);

  // Stop any reply still streaming when the chat goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Bring a new question into view when it is asked.
  const turnCount = messages.filter(m => m.role === 'user').length;
  useEffect(() => {
    if (turnCount > 0) {
      const reduceMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      logRef.current?.lastElementChild?.scrollIntoView?.({
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    }
  }, [turnCount]);

  async function ask(question: string) {
    const text = question.trim();
    if (text === '' || streaming) {
      return;
    }
    const history: ChatMessage[] = [...messages, {role: 'user', content: text}];
    setMessages([...history, {role: 'assistant', content: ''}]);
    setDraft('');
    setStatus({kind: 'streaming'});
    // Starter chips disappear once a question is asked; keep focus in the chat.
    inputRef.current?.focus();

    const controller = new AbortController();
    abortRef.current = controller;
    let reply = '';
    try {
      const ending = await streamChat({
        connection,
        system: buildResearchSystemPrompt(ticker),
        messages: history,
        signal: controller.signal,
        onText: chunk => {
          reply += chunk;
          setMessages([...history, {role: 'assistant', content: reply}]);
        },
      });
      setStatus({kind: 'ended', ending});
    } catch (error) {
      if (error instanceof AiError && error.kind === 'aborted') {
        setStatus({kind: 'stopped'});
      } else {
        setStatus({
          kind: 'error',
          message: describeAiError(error, connection.provider),
          quota: error instanceof AiError && error.kind === 'quota',
        });
      }
    } finally {
      // The Stop button is replaced by Ask when the answer ends; if it had
      // focus, move focus to the question box instead of losing it.
      if (document.activeElement === stopRef.current) {
        inputRef.current?.focus();
      }
      if (reply === '') {
        // Nothing came back: take the question out of the log and put it back
        // in the box, so it can be retried or edited without retyping.
        setMessages(messages);
        // Keep anything the user started typing meanwhile.
        setDraft(current => (current.trim() === '' ? text : current));
      }
      abortRef.current = undefined;
    }
  }

  function startOver() {
    setMessages([]);
    setStatus({kind: 'idle'});
    inputRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void ask(draft);
    }
  }

  return (
    <section className="chat" aria-labelledby="chat-title">
      <div className="chat__head">
        <h2 className="chat__title" id="chat-title">
          Ask {provider.product} about {ticker}
        </h2>
        <p className="chat__model">
          Using {modelName} · <a href={routeHref({page: 'settings'})}>Change</a>
        </p>
      </div>

      <p className="chat__disclaimer">
        {provider.product} answers from what it learned up to its last update,
        not today’s market, and it can be wrong. This is for learning, not a
        recommendation to buy or sell.
      </p>

      {messages.length === 0 ? (
        <div className="chat__starters">
          <p className="chat__starters-label">Start with a question:</p>
          <ul className="chip-list">
            {STARTER_QUESTIONS.map(question => (
              <li key={question.label}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => void ask(question.prompt(ticker))}
                >
                  {question.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol
          ref={logRef}
          className="chat__log"
          aria-label="Conversation"
          aria-busy={streaming}
        >
          {messages.map((message, index) => (
            <li
              key={index}
              className={`chat__message chat__message--${message.role}`}
            >
              <span className="chat__speaker">
                {message.role === 'user' ? 'You' : provider.product}
              </span>
              {message.role === 'user' ? (
                <p>{message.content}</p>
              ) : message.content === '' ? (
                <p className="chat__thinking">Thinking…</p>
              ) : (
                <AiAnswer text={message.content} />
              )}
            </li>
          ))}
        </ol>
      )}

      {/* One calm announcement per answer instead of every streamed word. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement(status, provider.product)}
      </p>

      {status.kind === 'error' && (
        <div className="chat__error" role="alert">
          <p>{status.message}</p>
          {status.quota && (
            <a href={provider.billingUrl} target="_blank" rel="noreferrer">
              Open {provider.label} billing
            </a>
          )}
        </div>
      )}
      {status.kind === 'ended' && ENDING_NOTES[status.ending] !== '' && (
        <p className="chat__note">{ENDING_NOTES[status.ending]}</p>
      )}
      {status.kind === 'stopped' && (
        <p className="chat__note">You stopped this answer.</p>
      )}

      <form className="chat__form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor={inputId}>
          Your question about {ticker}
        </label>
        <textarea
          id={inputId}
          ref={inputRef}
          className="chat__input"
          rows={2}
          placeholder={`Ask anything about ${ticker}… (Enter to send, Shift+Enter for a new line)`}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="chat__actions">
          {messages.length > 0 && !streaming && (
            <button type="button" className="button" onClick={startOver}>
              New conversation
            </button>
          )}
          {streaming ? (
            <button
              ref={stopRef}
              type="button"
              className="button"
              onClick={() => abortRef.current?.abort()}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className="button button--primary"
              disabled={draft.trim() === ''}
            >
              Ask
            </button>
          )}
        </div>
      </form>
      <p className="chat__fineprint">
        Your questions go straight from this browser to {provider.label}.
        TickerLens does not see or save them.
      </p>
    </section>
  );
}

function announcement(status: ChatStatus, product: string): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'streaming':
      return `${product} is answering…`;
    case 'ended':
      return status.ending === 'complete'
        ? 'Answer finished.'
        : ENDING_NOTES[status.ending];
    case 'stopped':
      return 'Answer stopped.';
    case 'error':
      return '';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
