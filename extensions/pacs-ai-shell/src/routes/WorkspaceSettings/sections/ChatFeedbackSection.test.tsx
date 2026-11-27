import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import type { ChatFeedbackItem } from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import ChatFeedbackSection, {
  formatTime,
  viewerStudyHref,
  voterLabel,
} from './ChatFeedbackSection';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(options[name] ?? '')),
    i18n: { language: 'en-US' },
  }),
}));
jest.mock('@pacs-ai/extension-core/src/service/userService', () => ({ logoutUser: jest.fn() }));
jest.mock('@pacs-ai/extension-core/src/api/orchestratorRepository', () => ({
  __esModule: true,
  default: {
    ListChatFeedback: jest.fn(),
    CountChatFeedback: jest.fn(),
    GetChatFeedback: jest.fn(),
  },
}));

const listChatFeedback = orchestratorRepository.ListChatFeedback as jest.Mock;
const countChatFeedback = orchestratorRepository.CountChatFeedback as jest.Mock;
const getChatFeedback = orchestratorRepository.GetChatFeedback as jest.Mock;

const toolCalls = [
  {
    seq: 0,
    parent_seq: null,
    depth: 0,
    agent: 'supervisor',
    specialist: 'angiogram-agent',
    tool: 'task',
    origin: 'model',
    status: 'ok',
    duration_ms: 52088,
    offset_ms: 0,
    model: null,
    args_summary: 'description=Read the LAD',
    run_selection: null,
    input: null,
    result_summary: 'LAD 70%. · 2 citations',
    error: null,
    result_truncated: false,
    arguments: { subagent_type: 'angiogram-agent', description: 'Read the LAD' },
  },
  {
    seq: 1,
    parent_seq: 0,
    depth: 1,
    agent: 'angiogram-agent',
    specialist: null,
    tool: 'deepcoro_jepa',
    origin: 'model',
    status: 'error',
    duration_ms: 171,
    offset_ms: 500,
    model: 'claude-haiku-5-5',
    args_summary: 'study_uid=[redacted]',
    run_selection: 'run=last → run 3 of 3 (last)',
    input: 'Series 5 – LCA · study 2026-01-02',
    result_summary: null,
    error: 'TimeoutError: slow',
    result_truncated: false,
    arguments: { study_uid: '[redacted]', run: 'last' },
  },
];

function item(overrides: Partial<ChatFeedbackItem> = {}): ChatFeedbackItem {
  return {
    feedback_id: 'fb-1',
    conversation_id: 'conv-1',
    message_id: 'answer-1',
    user_id: 'user-1',
    vote: 'down',
    category: 'wrong_value_or_measurement',
    comment: 'The LAD value is wrong',
    client: 'web',
    submission_version: 2,
    created_at: '2026-11-26T15:00:00',
    updated_at: '2026-11-26T15:01:00',
    question: 'What is the LAD stenosis?',
    answer: 'The LAD stenosis is 70 %.',
    study_instance_uid: '1.2.3.4',
    tenant_id: 'tenant-1',
    model: 'claude-test',
    skill: null,
    harness_version: 'h1',
    git_sha: null,
    app_version: null,
    origin: 'chat',
    specialists: ['angiogram-agent'],
    tool_count: 3,
    sealed_elsewhere: false,
    ...overrides,
  };
}

const counts = {
  range: { since: null, until: null },
  totals: { up: 1, down: 1, with_comment: 1, total: 2 },
  by_day: [{ date: '2026-11-26', up: 1, down: 1 }],
  by_week: [{ week_start: '2026-11-23', up: 1, down: 1 }],
  by_category: [{ vote: 'down', category: 'wrong_value_or_measurement', count: 1 }],
  by_specialist: [{ specialist: 'angiogram-agent', up: 0, down: 1 }],
  by_skill: [],
  by_harness_version: [],
};

describe('ChatFeedbackSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    listChatFeedback.mockReset().mockResolvedValue({
      data: {
        total: 2,
        limit: 50,
        offset: 0,
        items: [
          item(),
          item({
            feedback_id: 'fb-2',
            vote: 'up',
            category: 'other',
            comment: null,
            question: 'Up question',
          }),
        ],
      },
    });
    countChatFeedback.mockReset().mockResolvedValue({ data: counts });
    getChatFeedback.mockReset().mockResolvedValue({ data: { ...item(), tool_calls: toolCalls } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(active = true, showRaw = false) {
    await act(async () => {
      root.render(
        <ChatFeedbackSection
          active={active}
          showRaw={showRaw}
        />
      );
    });
  }

  it('lists the tool calls of an opened vote in order, with run, input, status and n/a', async () => {
    await render();
    expect(getChatFeedback).toHaveBeenCalledWith('fb-1');
    const calls = Array.from(container.querySelectorAll('[data-cy="chat-feedback-tool-call"]'));
    expect(calls).toHaveLength(2);
    expect(calls[0].textContent).toContain('Supervisor');
    expect(calls[0].textContent).toContain('ToolSpecialist');
    expect(calls[0].textContent).toContain('52.1 s');
    expect(calls[0].textContent).toContain('ToolModel: ToolNotAvailable');
    expect(calls[1].textContent).toContain('deepcoro_jepa');
    expect(calls[1].textContent).toContain('171 ms');
    expect(calls[1].textContent).toContain('ToolStatus_error');
    expect(calls[1].textContent).toContain('run=last → run 3 of 3 (last)');
    expect(calls[1].textContent).toContain('Series 5 – LCA');
    expect(calls[1].textContent).toContain('TimeoutError: slow');
    expect(calls[1].textContent).toContain('claude-haiku-5-5');
    // No raw JSON for non-admins.
    expect(container.textContent).not.toContain('ToolUseShowRaw');
  });

  it('shows the raw JSON toggle to admins and collapses the tool section', async () => {
    await render(true, true);
    const rawButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'ToolUseShowRaw'
    ) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(rawButton);
    });
    expect(container.querySelector('[data-cy="chat-feedback-tool-raw"]')?.textContent).toContain(
      '"tool": "deepcoro_jepa"'
    );
    const toolToggle = container.querySelector(
      '[data-cy="chat-feedback-tool-use"] button[aria-expanded]'
    ) as HTMLButtonElement;
    expect(toolToggle.getAttribute('aria-expanded')).toBe('true');
    await act(async () => {
      fireEvent.click(toolToggle);
    });
    expect(container.querySelectorAll('[data-cy="chat-feedback-tool-call"]')).toHaveLength(0);
  });

  it('says when a turn made no tool call or its trace is unavailable', async () => {
    getChatFeedback.mockResolvedValueOnce({ data: { ...item(), tool_calls: [] } });
    await render();
    expect(container.textContent).toContain('ToolUseNone');
    getChatFeedback.mockResolvedValueOnce({
      data: { ...item({ feedback_id: 'fb-2' }), tool_calls: null },
    });
    const toggles = Array.from(
      container.querySelectorAll('button[data-cy="chat-feedback-row-toggle"]')
    );
    await act(async () => {
      fireEvent.click(toggles[1]);
    });
    expect(container.textContent).toContain('ToolUseUnavailable');
  });

  it('names the voter from the user directory and falls back to the id', async () => {
    listChatFeedback.mockReset().mockResolvedValue({
      data: {
        total: 1,
        limit: 50,
        offset: 0,
        items: [item({ user_name: 'Alice Martin', user_email: 'alice@example.org' })],
      },
    });
    await render();
    expect(container.textContent).toContain('Alice Martin');
    expect(container.textContent).toContain('alice@example.org');
    expect(container.textContent).not.toContain('user-1');
    expect(voterLabel({ user_id: 'uid-1', user_name: null, user_email: null })).toEqual({
      primary: 'uid-1',
      secondary: null,
    });
    expect(voterLabel({ user_id: 'uid-1', user_email: 'a@b.c' })).toEqual({
      primary: 'a@b.c',
      secondary: null,
    });
  });

  it('shows the tool usage card with calls, error rate and median per vote', async () => {
    countChatFeedback.mockReset().mockResolvedValue({
      data: {
        ...counts,
        tool_usage: {
          totals: {
            up: {
              calls: 21,
              errors: 0,
              error_rate: 0,
              median_ms: 2571,
              timed_calls: 21,
              turns: 2,
              turns_with_trace: 2,
            },
            down: {
              calls: 0,
              errors: 0,
              error_rate: null,
              median_ms: null,
              timed_calls: 0,
              turns: 1,
              turns_with_trace: 1,
            },
          },
          by_tool: [
            {
              tool: 'firecrawl_search',
              up: { calls: 8, errors: 0, error_rate: 0, median_ms: 2526, timed_calls: 8 },
              down: { calls: 0, errors: 0, error_rate: null, median_ms: null, timed_calls: 0 },
            },
          ],
        },
      },
    });
    await render();
    const card = container.querySelector('[data-cy="chat-feedback-tool-usage"]');
    expect(card?.textContent).toContain('firecrawl_search');
    expect(card?.textContent).toContain('2.53 s');
    expect(card?.textContent).toContain('0%');
    expect(card?.textContent).toContain('ToolNotAvailable');
  });

  it('does not load while the tab is hidden', async () => {
    await render(false);
    expect(listChatFeedback).not.toHaveBeenCalled();
  });

  it('shows counts and opens thumbs down with question, answer, reason and study link', async () => {
    await render();
    expect(listChatFeedback).toHaveBeenCalledWith({ days: 90, limit: 50, offset: 0 });
    expect(countChatFeedback).toHaveBeenCalledWith({ days: 90 });
    const text = container.textContent ?? '';
    expect(text).toContain('TotalVotes');
    expect(text).toContain('50.0%');
    expect(text).toContain('What is the LAD stenosis?');
    expect(text).toContain('The LAD stenosis is 70 %.');
    expect(text).toContain('The LAD value is wrong');
    expect(text).toContain('FeedbackReason_wrong_value_or_measurement');
    expect(text).toContain('angiogram-agent');
    const link = container.querySelector('a[href^="/viewer"]');
    expect(link?.getAttribute('href')).toBe('/viewer?StudyInstanceUIDs=1.2.3.4');
    // The thumbs up row starts collapsed and expands on click.
    const toggles = Array.from(
      container.querySelectorAll('button[data-cy="chat-feedback-row-toggle"]')
    );
    expect(toggles.map(button => button.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    await act(async () => {
      fireEvent.click(toggles[1]);
    });
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('filters by rating and study', async () => {
    await render();
    const [, ratingSelect] = Array.from(container.querySelectorAll('select'));
    await act(async () => {
      fireEvent.change(ratingSelect, { target: { value: 'down' } });
    });
    expect(listChatFeedback).toHaveBeenLastCalledWith({
      days: 90,
      rating: 'down',
      limit: 50,
      offset: 0,
    });
    const studyInput = container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(studyInput, { target: { value: ' 1.2.3.4 ' } });
    });
    expect(listChatFeedback).toHaveBeenLastCalledWith({
      days: 90,
      study: '1.2.3.4',
      rating: 'down',
      limit: 50,
      offset: 0,
    });
    expect(countChatFeedback).toHaveBeenLastCalledWith({ days: 90, study: '1.2.3.4' });
  });

  it('loads the next page with an advancing offset and appends it', async () => {
    listChatFeedback.mockReset().mockResolvedValueOnce({
      data: { total: 3, limit: 50, offset: 0, items: [item(), item({ feedback_id: 'fb-2' })] },
    });
    await render();
    listChatFeedback.mockResolvedValueOnce({
      data: {
        total: 3,
        limit: 50,
        offset: 2,
        items: [item({ feedback_id: 'fb-3', question: 'Third question' })],
      },
    });
    const more = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'ShowMore'
    ) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(more);
    });
    expect(listChatFeedback).toHaveBeenLastCalledWith({ days: 90, limit: 50, offset: 2 });
    expect(container.querySelectorAll('button[data-cy="chat-feedback-row-toggle"]')).toHaveLength(
      3
    );
    expect(container.textContent).toContain('Third question');
    expect(
      Array.from(container.querySelectorAll('button')).some(
        button => button.textContent === 'ShowMore'
      )
    ).toBe(false);
  });

  it('says when the chat service is not connected', async () => {
    listChatFeedback.mockRejectedValue({ errorCode: 'chat_feedback_not_configured' });
    await render();
    expect(container.textContent).toContain('NotConfigured');
  });

  it('escapes the study UID in the viewer link', () => {
    expect(viewerStudyHref('1.2&x=3')).toBe('/viewer?StudyInstanceUIDs=1.2%26x%3D3');
  });

  it('formats times even when the browser language is not a valid Intl tag', () => {
    expect(() => formatTime('2026-11-26T15:01:00', 'en-US@POSIX')).not.toThrow();
    expect(formatTime('2026-11-26T15:01:00', 'en-US@POSIX')).toContain('2026');
    expect(formatTime(null, 'fr')).toBe('—');
    // Naive backend times are wall-clock times, shown as they are.
    const shown = formatTime('2026-11-26T11:17:38', 'en');
    expect(shown).toMatch(/11:17/);
  });
});
