import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AiError} from '../lib/ai/chat';
import {AI_CONNECTION_KEY, readConnection} from '../lib/ai/connection';
import {AiConnectionForm} from './ai_connection_form';

const listModels = vi.hoisted(() => vi.fn());

vi.mock('../lib/ai/chat', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/ai/chat')>()),
  listModels,
}));

describe('AiConnectionForm', () => {
  beforeEach(() => {
    listModels.mockReset();
  });

  it('rejects a key for the wrong provider without calling anyone', async () => {
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.type(screen.getByLabelText('Anthropic API key'), 'sk-proj-abc');
    await user.click(screen.getByRole('button', {name: 'Connect'}));

    expect(screen.getByRole('status')).toHaveTextContent(
      /does not look like an Anthropic key/,
    );
    expect(listModels).not.toHaveBeenCalled();
    expect(readConnection()).toBeUndefined();
  });

  it('verifies the key with the provider and saves it locally', async () => {
    listModels.mockResolvedValue([
      {id: 'claude-opus-5-5', label: 'Claude Opus 5.5'},
    ]);
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.type(
      screen.getByLabelText('Anthropic API key'),
      'sk-ant-api03-secret',
    );
    await user.click(screen.getByRole('button', {name: 'Connect'}));

    expect(await screen.findByText(/Your key works/)).toBeVisible();
    expect(listModels).toHaveBeenCalledWith(
      'anthropic',
      'sk-ant-api03-secret',
      expect.any(AbortSignal),
    );
    expect(readConnection()).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-ant-api03-secret',
      model: 'claude-opus-5-5',
      persistence: 'device',
    });
  });

  it('switches to an available model when the typed one is missing', async () => {
    listModels.mockResolvedValue([{id: 'gpt-x', label: 'gpt-x'}]);
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.click(screen.getByRole('radio', {name: /^ChatGPT\s*by OpenAI/}));
    await user.type(screen.getByLabelText('OpenAI API key'), 'sk-proj-abc');
    await user.click(screen.getByRole('button', {name: 'Connect'}));

    await screen.findByText(/Your key works/);
    expect(readConnection()?.model).toBe('gpt-x');
    expect(screen.getByLabelText('AI model')).toHaveValue('gpt-x');
  });

  it('keeps tab-only keys out of localStorage', async () => {
    listModels.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.type(screen.getByLabelText('Anthropic API key'), 'sk-ant-k');
    await user.click(screen.getByRole('radio', {name: /This tab only/}));
    await user.click(screen.getByRole('button', {name: 'Connect'}));

    await screen.findByText(/Your key works/);
    expect(localStorage.getItem(AI_CONNECTION_KEY)).toBeNull();
    expect(sessionStorage.getItem(AI_CONNECTION_KEY)).toContain('sk-ant-k');
  });

  it('does not save a key the provider rejects', async () => {
    listModels.mockRejectedValue(new AiError('auth', 'invalid x-api-key'));
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.type(screen.getByLabelText('Anthropic API key'), 'sk-ant-bad');
    await user.click(screen.getByRole('button', {name: 'Connect'}));

    expect(
      await screen.findByText(/did not accept this key/),
    ).toBeInTheDocument();
    expect(readConnection()).toBeUndefined();
    const keyInput = screen.getByLabelText('Anthropic API key');
    expect(keyInput).toHaveAttribute('aria-invalid', 'true');
    expect(keyInput).toHaveFocus();
  });

  it('forgets a saved key', async () => {
    const connection = {
      provider: 'anthropic' as const,
      apiKey: 'sk-ant-api03-abcdefghijk',
      model: 'claude-opus-5-5',
      persistence: 'device' as const,
    };
    localStorage.setItem(AI_CONNECTION_KEY, JSON.stringify(connection));
    const user = userEvent.setup();
    render(<AiConnectionForm connection={connection} />);

    expect(screen.getByRole('status')).toHaveTextContent('sk-ant-…hijk');
    await user.click(
      screen.getByRole('button', {name: 'Disconnect and forget key'}),
    );

    expect(readConnection()).toBeUndefined();
    expect(screen.getByLabelText('Anthropic API key')).toHaveValue('');
  });

  it('offers to sign in with a ChatGPT plan instead of a key', async () => {
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.click(screen.getByRole('radio', {name: /^ChatGPT plan/}));

    expect(
      screen.getByRole('button', {name: 'Sign in with ChatGPT'}),
    ).toBeVisible();
    expect(screen.queryByLabelText(/API key/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Connect'}),
    ).not.toBeInTheDocument();
  });

  it('shows which ChatGPT account is signed in', () => {
    render(
      <AiConnectionForm
        connection={{
          provider: 'codex',
          model: 'gpt-6-luna',
          persistence: 'device',
          tokens: {
            accessToken: 'a',
            refreshToken: 'r',
            idToken: '',
            accountId: 'acct',
            email: 'paul@example.com',
            plan: 'plus',
            expiresAt: Date.now() + 3600_000,
          },
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'paul@example.com (Plus plan)',
    );
    expect(
      screen.getByRole('button', {name: 'Sign out and forget'}),
    ).toBeVisible();
  });
});
