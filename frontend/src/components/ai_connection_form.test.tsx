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
    await user.click(screen.getByRole('button', {name: 'Verify and save'}));

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
    await user.click(screen.getByRole('button', {name: 'Verify and save'}));

    expect(await screen.findByText(/Key verified and saved/)).toBeVisible();
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

    await user.click(screen.getByRole('radio', {name: /ChatGPT/}));
    await user.type(screen.getByLabelText('OpenAI API key'), 'sk-proj-abc');
    await user.click(screen.getByRole('button', {name: 'Verify and save'}));

    await screen.findByText(/Key verified and saved/);
    expect(readConnection()?.model).toBe('gpt-x');
    expect(screen.getByLabelText('Model')).toHaveValue('gpt-x');
  });

  it('keeps tab-only keys out of localStorage', async () => {
    listModels.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.type(screen.getByLabelText('Anthropic API key'), 'sk-ant-k');
    await user.click(screen.getByRole('radio', {name: /This tab only/}));
    await user.click(screen.getByRole('button', {name: 'Verify and save'}));

    await screen.findByText(/Key verified and saved/);
    expect(localStorage.getItem(AI_CONNECTION_KEY)).toBeNull();
    expect(sessionStorage.getItem(AI_CONNECTION_KEY)).toContain('sk-ant-k');
  });

  it('does not save a key the provider rejects', async () => {
    listModels.mockRejectedValue(new AiError('auth', 'invalid x-api-key'));
    const user = userEvent.setup();
    render(<AiConnectionForm />);

    await user.type(screen.getByLabelText('Anthropic API key'), 'sk-ant-bad');
    await user.click(screen.getByRole('button', {name: 'Verify and save'}));

    expect(
      await screen.findByText(/rejected this API key/),
    ).toBeInTheDocument();
    expect(readConnection()).toBeUndefined();
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
});
