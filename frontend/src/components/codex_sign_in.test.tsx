import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {CodexTokens} from '../lib/ai/connection';
import {CodexSignIn} from './codex_sign_in';

const auth = vi.hoisted(() => ({
  requestDeviceCode: vi.fn(),
  waitForDeviceApproval: vi.fn(),
}));

vi.mock('../lib/ai/codex_auth', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/ai/codex_auth')>()),
  ...auth,
}));

const TOKENS: CodexTokens = {
  accessToken: 'a',
  refreshToken: 'r',
  idToken: '',
  accountId: 'acct-123',
  expiresAt: Date.now() + 3600_000,
};

describe('CodexSignIn', () => {
  beforeEach(() => {
    auth.requestDeviceCode.mockReset();
    auth.waitForDeviceApproval.mockReset();
  });

  it('shows the code and where to enter it, then finishes on its own', async () => {
    auth.requestDeviceCode.mockResolvedValue({
      deviceAuthId: 'd',
      userCode: 'ABCD-EFGH',
      intervalMs: 5000,
      expiresAt: Date.now() + 15 * 60_000,
    });
    let approve: (tokens: CodexTokens) => void = () => {};
    auth.waitForDeviceApproval.mockReturnValue(
      new Promise<CodexTokens>(resolve => {
        approve = resolve;
      }),
    );
    const onSignedIn = vi.fn();
    const user = userEvent.setup();
    render(<CodexSignIn onSignedIn={onSignedIn} relayUrl="/ai-proxy/codex" />);

    await user.click(
      screen.getByRole('button', {name: 'Sign in with ChatGPT'}),
    );

    expect(await screen.findByText('ABCD-EFGH')).toBeVisible();
    expect(
      screen.getByRole('link', {name: /auth\.openai\.com\/codex\/device/}),
    ).toHaveAttribute('href', 'https://auth.openai.com/codex/device');
    expect(screen.getByRole('status')).toHaveTextContent(/Waiting for you/);

    approve(TOKENS);
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(TOKENS));
  });

  it('explains a failed sign-in', async () => {
    const {CodexSignInError} = await import('../lib/ai/codex_auth');
    auth.requestDeviceCode.mockRejectedValue(
      new CodexSignInError('Device sign-in is off.'),
    );
    const user = userEvent.setup();
    render(<CodexSignIn onSignedIn={vi.fn()} relayUrl="/ai-proxy/codex" />);

    await user.click(
      screen.getByRole('button', {name: 'Sign in with ChatGPT'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Device sign-in is off.',
    );
  });

  it('says it needs a TickerLens server when there is no relay', () => {
    render(<CodexSignIn onSignedIn={vi.fn()} relayUrl="" />);
    expect(screen.getByText(/only works on a TickerLens server/)).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Sign in with ChatGPT'}),
    ).not.toBeInTheDocument();
  });
});
