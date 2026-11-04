import {useState} from 'react';
import {AiConnectionForm} from '../components/ai_connection_form';
import {LocalDataPanel} from '../components/local_data_panel';
import {PageHeading} from '../components/page_heading';
import {TextSizeControl} from '../components/text_size_control';
import {useAiConnection} from '../lib/ai/use_connection';

/** AI connection, display and privacy settings at `#/settings`. */
export function SettingsPage() {
  const connection = useAiConnection();
  // Bumped after "delete everything" so stateful controls re-read storage.
  const [generation, setGeneration] = useState(0);

  return (
    <div className="app-page container">
      <PageHeading eyebrow="Settings" title="Settings">
        <p>
          Everything on this page is stored in this browser on your computer.
          TickerLens servers never receive it.
        </p>
      </PageHeading>

      <div className="settings">
        <section className="settings__section" aria-labelledby="ai-title">
          <div className="settings__aside">
            <h2 className="settings__title" id="ai-title">
              Connect your AI
            </h2>
            <p>
              TickerLens explains stocks using your own Claude or ChatGPT
              account through an API key. You pay the provider directly for what
              you use, usually a few cents per conversation.
            </p>
            <details className="faq">
              <summary>Can I use my ChatGPT Plus or Claude Pro plan?</summary>
              <p>
                Not directly. OpenAI and Anthropic only let their monthly chat
                subscriptions be used inside their own apps; they do not offer a
                way for other websites to sign in with them. An API key from the
                same account is the supported route, and it is billed per use
                rather than from your subscription. If either company adds a
                sign-in option for other sites, TickerLens can add it here.
              </p>
            </details>
            <details className="faq">
              <summary>Is it safe to paste my key here?</summary>
              <p>
                The key stays in this browser. Requests go from your computer
                straight to Anthropic’s or OpenAI’s API; there is no TickerLens
                server in between, and the published site blocks connections to
                any other address. Anyone with access to this browser profile
                could read it, so on a shared computer choose “This tab only”.
                For extra safety, create a key just for TickerLens with a
                spending limit, and revoke it from the provider’s dashboard
                whenever you like.
              </p>
            </details>
          </div>
          <AiConnectionForm key={generation} connection={connection} />
        </section>

        <section className="settings__section" aria-labelledby="display-title">
          <div className="settings__aside">
            <h2 className="settings__title" id="display-title">
              Display
            </h2>
            <p>Make text larger across the whole site.</p>
          </div>
          <div className="settings__control">
            <TextSizeControl />
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
