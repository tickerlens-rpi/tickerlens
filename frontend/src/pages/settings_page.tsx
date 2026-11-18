import {useState} from 'react';
import {Link} from 'react-router';
import {AiConnectionForm} from '../components/ai_connection_form';
import {LocalDataPanel} from '../components/local_data_panel';
import {PageHeading} from '../components/page_heading';
import {TextSizeControl} from '../components/text_size_control';
import {useAiConnection} from '../lib/ai/use_connection';
import {useDocumentTitle} from '../lib/hooks';

/** AI connection, display and privacy settings at `/settings`. */
export function SettingsPage() {
  useDocumentTitle('Settings · TickerLens');
  const connection = useAiConnection();
  // Bumped after "delete everything" so stateful controls re-read storage.
  const [generation, setGeneration] = useState(0);

  return (
    <div className="app-page container">
      <PageHeading eyebrow="Settings" title="Settings">
        <p>
          Everything on this page is saved in this browser, on your computer.
          TickerLens does not store it.
        </p>
      </PageHeading>

      <div className="settings">
        <section className="settings__section" aria-labelledby="ai-title">
          <div className="settings__aside">
            <h2 className="settings__title" id="ai-title">
              Connect your AI
            </h2>
            <p>
              TickerLens summarizes news and answers questions using your own
              Claude, ChatGPT or Gemini. Connect it once with an{' '}
              <strong>API key</strong>, a password-like code that lets this site
              ask the AI on your behalf, or sign in with your ChatGPT plan.
            </p>
            <details className="faq">
              <summary>Can I use my ChatGPT Plus or Claude Pro plan?</summary>
              <p>
                <strong>ChatGPT: yes, as an experiment.</strong> Choose “ChatGPT
                plan” and sign in the same way OpenAI’s Codex app does. Answers
                then count toward your plan’s Codex usage limits instead of
                costing per question. OpenAI does not officially offer this to
                other websites, so it may stop working; an API key is the
                dependable route.
              </p>
              <p>
                <strong>Claude: no.</strong> Anthropic only lets its Pro and Max
                plans be used in its own apps, so connect a Claude API key
                instead. It is billed per question, usually a few cents.
              </p>
            </details>
            <details className="faq">
              <summary>Is it safe to paste my key here?</summary>
              <p>
                Your key or sign-in stays in this browser on your computer. With
                an API key, questions go from your computer straight to
                Anthropic, OpenAI or Google, with no TickerLens server in
                between. With a ChatGPT plan, chatgpt.com does not accept
                questions sent from other websites, so they pass through the
                TickerLens server, which forwards them without keeping anything.
              </p>
              <p>
                Anyone who uses this browser profile could find the key, so on a
                shared computer choose “This tab only”. For extra peace of mind,
                make a key just for TickerLens, set a spending limit, and delete
                the key from the provider’s site whenever you like.
              </p>
            </details>
          </div>
          <AiConnectionForm
            key={generation}
            connection={connection}
            savedAction={
              <Link className="button button--primary" to="/research">
                Research a stock →
              </Link>
            }
          />
        </section>

        <section className="settings__section" aria-labelledby="display-title">
          <div className="settings__aside">
            <h2 className="settings__title" id="display-title">
              Display
            </h2>
            <p>Make text larger across the whole site.</p>
            <div className="settings__control">
              <TextSizeControl />
              <span className="settings__control-hint">
                Default · Large · Larger
              </span>
            </div>
          </div>
        </section>

        <section className="settings__section" aria-labelledby="data-title">
          <div className="settings__aside">
            <h2 className="settings__title" id="data-title">
              Your data
            </h2>
            <p>What TickerLens keeps, and where.</p>
          </div>
          <LocalDataPanel onCleared={() => setGeneration(n => n + 1)} />
        </section>
      </div>
    </div>
  );
}
