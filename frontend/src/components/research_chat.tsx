import {useEffect, useId, useRef, useState} from 'react';
import type {FormEvent, KeyboardEvent} from 'react';
import {AiError, describeAiError, streamChat} from '../lib/ai/chat';
import type {ChatEnding, ChatMessage} from '../lib/ai/chat';
import {PROVIDERS} from '../lib/ai/connection';
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
}

type ChatStatus =
  | {kind: 'idle'}
  | {kind: 'streaming'}
  | {kind: 'ended'; ending: ChatEnding}
  | {kind: 'error'; message: string};

const ENDING_NOTES: Record<ChatEnding, string> = {
  complete: '',
  truncated: 'The answer hit its length limit and was cut short.',
  refused: 'The model declined to answer this one. Try rephrasing.',
};

/**
 * Chat about one ticker with the user's connected model. The conversation
 * lives in memory only and is gone when the page changes.
 */
export function ResearchChat({ticker, connection}: ResearchChatProps) {
  const inputId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<ChatStatus>({kind: 'idle'});
  const abortRef = useRef<AbortController | undefined>(undefined);
  const streaming = status.kind === 'streaming';
  const provider = PROVIDERS[connection.provider];

  // Stop any reply still streaming when the chat goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function ask(question: string) {
    const text = question.trim();
    if (text === '' || streaming) {
      return;
    }
    const history: ChatMessage[] = [...messages, {role: 'user', content: text}];
    setMessages([...history, {role: 'assistant', content: ''}]);
    setDraft('');
    setStatus({kind: 'streaming'});

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
        setStatus({kind: 'ended', ending: 'complete'});
      } else {
        setStatus({kind: 'error', message: describeAiError(error)});
      }
    } finally {
      if (reply === '') {
        // Drop the empty placeholder so a failed turn can simply be retried.
        setMessages(history);
      }
      abortRef.current = undefined;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void ask(draft);
    }
  }

  return (
    <section className="chat" aria-labelledby="chat-title">
      <div className="chat__head">
        <h2 className="chat__title" id="chat-title">
          Ask about {ticker}
        </h2>
        <p className="chat__model">
          {provider.product} · <code>{connection.model}</code> ·{' '}
          <a href={routeHref({page: 'settings'})}>change</a>
        </p>
      </div>

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
        <ol className="chat__log" aria-label="Conversation" aria-live="polite">
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

      {status.kind === 'error' && (
        <p className="chat__error" role="alert">
          {status.message}
        </p>
      )}
      {status.kind === 'ended' && ENDING_NOTES[status.ending] !== '' && (
        <p className="chat__note" role="status">
          {ENDING_NOTES[status.ending]}
        </p>
      )}

      <form className="chat__form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor={inputId}>
          Your question about {ticker}
        </label>
        <textarea
          id={inputId}
          className="chat__input"
          rows={2}
          placeholder={`Ask anything about ${ticker}…`}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="chat__actions">
          {messages.length > 0 && !streaming && (
            <button
              type="button"
              className="button"
              onClick={() => {
                setMessages([]);
                setStatus({kind: 'idle'});
              }}
            >
              New conversation
            </button>
          )}
          {streaming ? (
            <button
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
        Answers come from {provider.product}’s training knowledge, not live
        data, and can be wrong or out of date. Research and education only, not
        advice. Your question goes straight from this browser to{' '}
        {provider.label}.
      </p>
    </section>
  );
}
