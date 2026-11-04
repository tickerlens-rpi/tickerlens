import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AiError} from '../lib/ai/chat';
import type {ChatRequest} from '../lib/ai/chat';
import type {AiConnection} from '../lib/ai/connection';
import {ResearchChat} from './research_chat';

const streamChat = vi.hoisted(() => vi.fn());

vi.mock('../lib/ai/chat', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/ai/chat')>()),
  streamChat,
}));

const CONNECTION: AiConnection = {
  provider: 'anthropic',
  apiKey: 'sk-ant-test',
  model: 'claude-opus-5-5',
  persistence: 'device',
};

describe('ResearchChat', () => {
  beforeEach(() => {
    streamChat.mockReset();
  });

  it('streams an answer to a starter question', async () => {
    streamChat.mockImplementation(async ({onText}: ChatRequest) => {
      onText('**Apple** makes ');
      onText('iPhones.');
      return 'complete';
    });
    const user = userEvent.setup();
    render(<ResearchChat ticker="AAPL" connection={CONNECTION} />);

    await user.click(screen.getByRole('button', {name: 'What does it do?'}));

    expect(await screen.findByText('Apple')).toHaveProperty(
      'tagName',
      'STRONG',
    );
    expect(screen.getByText('makes iPhones.', {exact: false})).toBeVisible();
    const [request] = streamChat.mock.calls[0] as [ChatRequest];
    expect(request.connection).toBe(CONNECTION);
    expect(request.system).toMatch(/AAPL/);
    expect(request.system).toMatch(/not financial advice/);
    expect(request.messages).toEqual([
      {role: 'user', content: expect.stringMatching(/AAPL/)},
    ]);
  });

  it('sends the conversation so far with follow-up questions', async () => {
    streamChat.mockImplementation(async ({onText}: ChatRequest) => {
      onText('Answer.');
      return 'complete';
    });
    const user = userEvent.setup();
    render(<ResearchChat ticker="MSFT" connection={CONNECTION} />);

    await user.type(screen.getByRole('textbox'), 'First?{Enter}');
    await screen.findByText('Answer.');
    await user.type(screen.getByRole('textbox'), 'Second?{Enter}');

    const [request] = streamChat.mock.calls[1] as [ChatRequest];
    expect(request.messages).toEqual([
      {role: 'user', content: 'First?'},
      {role: 'assistant', content: 'Answer.'},
      {role: 'user', content: 'Second?'},
    ]);
  });

  it('explains provider errors', async () => {
    streamChat.mockRejectedValue(new AiError('rate-limit', '429'));
    const user = userEvent.setup();
    render(<ResearchChat ticker="AAPL" connection={CONNECTION} />);

    await user.type(screen.getByRole('textbox'), 'Hi{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(/rate-limiting/);
  });

  it('says when the model declined', async () => {
    streamChat.mockImplementation(async ({onText}: ChatRequest) => {
      onText('I can’t help with that.');
      return 'refused';
    });
    const user = userEvent.setup();
    render(<ResearchChat ticker="AAPL" connection={CONNECTION} />);

    await user.type(screen.getByRole('textbox'), 'Hi{Enter}');

    expect(await screen.findByText(/declined to answer/)).toBeVisible();
  });
});
