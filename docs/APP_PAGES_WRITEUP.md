# App pages and bring-your-own AI: write-up

Branch: `feature/app-pages-and-ai-connection`

This change turns the TickerLens landing page into a small working app. It
adds three pages (Research, Watchlist and Settings) and lets each user connect
their own Claude or ChatGPT account so the Research page can answer questions
about a stock.

## What was built

| Page      | Route                 | What it does                                                                                                                                                |
| --------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Research  | `#/research/<TICKER>` | Ask the connected AI about a ticker: four starter questions or free chat, streamed answers, stop, retry. Connect an AI right on the page if none is set up. |
| Watchlist | `#/watchlist`         | Saved tickers with personal notes. Notes save as you type.                                                                                                  |
| Settings  | `#/settings`          | Connect Claude or ChatGPT with step-by-step key help, choose where the key is kept, text size, and "delete all TickerLens data on this computer".           |

Searching a ticker on the landing page now opens its research page. The header
has page links and a "Claude connected" indicator. Routing is hash-based, so
the site still works from any static host.

## Linking a Claude or ChatGPT account

**Monthly chat subscriptions cannot be used.** ChatGPT Plus and Claude Pro/Max
only work inside OpenAI's and Anthropic's own apps; neither company offers a
way for other websites to sign in with them. The supported route is an API key
from a developer account with the same company. It is billed per question
(roughly 2 to 10 cents with the default model) instead of monthly. Settings
explains this to users, and TickerLens can add a sign-in option if either
company ever offers one.

## Keeping the key on the user's computer

The requirement was that a TickerLens server never handles sensitive data.

- **Stored only in the browser.** The key, watchlist, notes and preferences
  live in `localStorage`, or `sessionStorage` if the user picks "This tab
  only". Conversations are not saved at all.
- **Sent straight to the provider.** Questions go from the browser directly to
  `api.anthropic.com` or `api.openai.com` through the official SDKs. There is
  no TickerLens server in between.
- **Blocked from going anywhere else.** Production builds include a
  Content-Security-Policy (`frontend/vite.config.ts`) that only allows
  connections to the site itself and those two APIs. When the central API
  exists, its address must be added there.
- **AI answers cannot inject code.** They are rendered from a small Markdown
  subset into React elements, never as HTML.
- **The landing page stays light.** The AI SDKs only download when someone
  uses the chat.

## Review council

Three independent reviewers looked at the pages from different angles, using
screenshots of the production build (desktop and true 390px phone width) and
the code. The bar was: each says the pages work, fit the rest of the site and
have good UI/UX, and scores them at least 7.5/10.

| Reviewer                    | Round 1 | Round 2 |
| --------------------------- | ------- | ------- |
| Visual design               | 7.0     | **8.0** |
| Interaction & accessibility | 7.0     | **8.3** |
| Beginner investor           | 6.5     | **8.0** |

All three passed in round 2.

### What round 1 found, and what changed

- **Visual design.** The footer floated mid-page on short pages, the search box
  outranked the chat, inputs looked disabled, and little of the landing page's
  "annotated ledger" look carried over. Fixed by pinning the footer, moving a
  compact search beside the page title, lightening inputs, adding the ruled
  lines and margin line behind page headings, and restyling the watchlist as
  ledger rows.
- **Interaction & accessibility.** The "Skip to content" link sent people to
  the home page, screen readers read streaming answers in fragments, keyboard
  focus jumped to the top whenever a button disappeared, failed questions had
  to be retyped, and small grey text failed contrast. All fixed, with tests for
  the skip link, retry and key-field errors.
- **Beginner investor.** There were no steps for getting a key, the model name
  was jargon, users were left on Settings after connecting, and the "no live
  data" notice was technical. Fixed with step-by-step key help per provider, a
  spending-limit tip, the model moved under "Advanced" with friendly names, the
  connect form shown right on the research page, and plainer wording
  throughout.

## Decisions to confirm

- **Default model.** Claude Opus 5.5 for Claude. The beginner reviewer
  suggested a cheaper default; that is a product decision for the team.
- **ChatGPT default.** `gpt-5` is a best guess. If a key cannot use it, the
  form switches to the newest model the key can use.
- **Safety fallback.** For the newest Claude models, a declined request is
  retried on a fallback model Anthropic chooses.

## Suggested follow-ups

None of these blocked the review.

- The landing page still promises "the source behind every claim", which the
  AI chat cannot deliver until live data and sources exist. Soften that line
  for now.
- The research page says "answers may be out of date" in three places. On
  phones, move the notice below the chat.
- On phones, tapping a starter question opens the keyboard over the answer.
- The phone header's connected indicator just says "Claude"; "Claude on" would
  read more clearly as a status.

## Verification

- `npm run check` in `frontend/` passes: lint, typecheck and 103 tests.
- `npm run build` succeeds, with the security policy present and no inline
  scripts.
- Not yet tested against a real API key. That is the first thing to try:
  connect a key in Settings, then ask a question on any ticker's research page.
