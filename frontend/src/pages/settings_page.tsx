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
          TickerLens never receives it.
        </p>
      </PageHeading>

      <div className="settings">
        <section className="settings__section" aria-labelledby="ai-title">
          <div className="settings__aside">
            <h2 className="settings__title" id="ai-title">
              Connect your AI
            </h2>
            <p>
              TickerLens explains stocks using Claude or ChatGPT through your
              own developer account. You connect it once with an{' '}
              <strong>API key</strong>, a password-like code that lets this site
              ask the AI questions on your behalf.
            </p>
            <details className="faq">
              <summary>Can I use my ChatGPT Plus or Claude Pro plan?</summary>
              <p>
                Not directly. OpenAI and Anthropic only let their monthly chat
                plans be used inside their own apps, and they do not offer a way
                for other websites to sign in with them. A developer account
                with the same company is the supported route. It is billed per
                question instead of monthly, and usually costs a few cents per
                question. If either company adds a sign-in option for other
                sites, TickerLens will add it here.
              </p>
            </details>
            <details className="faq">
              <summary>Is it safe to paste my key here?</summary>
              <p>
                Your key stays in this browser on your computer. Questions go
                from your computer straight to Anthropic or OpenAI, with no
                TickerLens server in between, and the site is built so it can
                only talk to those two companies. Anyone who uses this browser
                profile could find the key, so on a shared computer choose “This
                tab only”. For extra peace of mind, make a key just for
                TickerLens, set a spending limit, and delete the key from the
                provider’s site whenever you like.
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
