import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { setTestLocale } from '../testUtils/chatBoxTranslation';
import type { ChatActivity, Message } from '../types';

jest.mock('react-i18next', () => ({
  useTranslation: () => require('../testUtils/chatBoxTranslation').useTranslationMock(),
}));

const SENT_AT = new Date('2026-11-14T22:27:20.000Z');

const liveActivity: ChatActivity = {
  status: 'running',
  elapsed_ms: 9000,
  steps: [
    {
      id: 1,
      key: 'delegate_angiogram',
      kind: 'delegation',
      label: 'Consulting the angiography specialist',
      status: 'running',
    },
    {
      id: 2,
      key: 'study_models',
      kind: 'tool',
      label: 'Checking which models have results',
      status: 'done',
      duration_ms: 140,
    },
    {
      id: 3,
      key: 'model_result',
      kind: 'tool',
      label: 'Reading the stored DeepCORO-JEPA result',
      model: 'DeepCORO-JEPA',
      status: 'running',
    },
  ],
};

const finishedActivity: ChatActivity = {
  status: 'done',
  elapsed_ms: 58_000,
  steps: [
    {
      id: 1,
      key: 'delegate_angiogram',
      kind: 'delegation',
      label: 'Consulting the angiography specialist',
      status: 'done',
      duration_ms: 47_000,
    },
    {
      id: 2,
      key: 'study_models',
      kind: 'tool',
      label: 'Checking which models have results',
      status: 'done',
      duration_ms: 140,
    },
    {
      id: 3,
      key: 'model_result',
      kind: 'tool',
      label: 'Reading the stored DeepCORO-JEPA result',
      model: 'DeepCORO-JEPA',
      status: 'done',
      duration_ms: 320,
    },
    {
      id: 4,
      key: 'run_model',
      kind: 'tool',
      label: 'Running DeepCORO-SCAD',
      model: 'DeepCORO-SCAD',
      status: 'failed',
      duration_ms: 30_000,
    },
    {
      id: 5,
      key: 'web_search',
      kind: 'tool',
      label: 'Searching the web',
      status: 'done',
      duration_ms: 2100,
    },
    {
      id: 6,
      key: 'web_read',
      kind: 'tool',
      label: 'Reading a source',
      status: 'done',
      duration_ms: 4000,
    },
  ],
};

const thinkingMessage: Message = {
  id: 'thinking',
  sender: 'assistant',
  text: 'Thinking...',
  timestamp: SENT_AT,
  isThinking: true,
};

const answer = (activity?: ChatActivity): Message => ({
  id: 'answer',
  sender: 'assistant',
  text: 'Here is the summary.',
  timestamp: SENT_AT,
  ...(activity ? { activity } : {}),
});

describe('thinking indicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(SENT_AT.getTime() + 9000));
  });

  afterEach(() => {
    jest.useRealTimers();
    setTestLocale('en-US');
  });

  it("shows today's plain indicator when there is no progress", () => {
    const { container } = render(<MessageBubble message={thinkingMessage} />);

    expect(container.textContent).toContain('Thinking...');
    expect(container.querySelector('[data-cy="chat-activity-live"]')).toBeNull();
    expect(container.querySelector('[data-cy="chat-activity-elapsed"]')).toBeNull();
    expect(container.querySelectorAll('.thinking-dot')).toHaveLength(3);
  });

  it('lists the live steps with a check on completed ones and the indicator on the current one', () => {
    const { container } = render(
      <MessageBubble
        message={thinkingMessage}
        progress={liveActivity}
      />
    );

    const items = Array.from(container.querySelectorAll('[data-cy="chat-activity-steps"] li'));
    expect(items.map(item => item.getAttribute('data-status'))).toEqual([
      'running',
      'done',
      'running',
    ]);
    expect(items[0].textContent).toContain('Consulting the angiography specialist');
    expect(items[1].textContent).toContain('Checking which models have results');
    expect(items[1].querySelector('[aria-label="Done"]')?.textContent).toBe('✓');
    expect(items[2].textContent).toContain('Reading the stored DeepCORO-JEPA result');
    expect(items[2].querySelector('[aria-label="In progress"]')?.className).toContain(
      'thinking-dot'
    );
    // No per-step durations while thinking; one elapsed counter for the request.
    expect(items[1].textContent).not.toContain('<1 s');
    expect(container.querySelector('[data-cy="chat-activity-elapsed"]')?.textContent).toBe('9 s');
    // A step is running: the bare "Thinking" line is not repeated.
    expect(container.textContent).not.toContain('Thinking');
  });

  it('counts elapsed seconds locally between polls', () => {
    const { container } = render(
      <ThinkingIndicator
        activity={liveActivity}
        startedAt={SENT_AT}
      />
    );
    const elapsed = () => container.querySelector('[data-cy="chat-activity-elapsed"]')?.textContent;

    expect(elapsed()).toBe('9 s');
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(elapsed()).toBe('12 s');
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(elapsed()).toBe('1 min 12 s');
  });

  it('keeps "Thinking" with the elapsed time between two steps', () => {
    const betweenSteps: ChatActivity = {
      steps: liveActivity.steps.map(step => ({ ...step, status: 'done' })),
    };
    const { container } = render(
      <ThinkingIndicator
        activity={betweenSteps}
        startedAt={SENT_AT}
      />
    );

    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.textContent).toContain('Thinking...');
    expect(container.querySelector('[data-cy="chat-activity-elapsed"]')?.textContent).toBe('9 s');
  });

  it('shows "Thinking" and the elapsed time before the first step', () => {
    const { container } = render(
      <ThinkingIndicator
        activity={{ steps: [] }}
        startedAt={SENT_AT}
      />
    );

    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(container.textContent).toContain('Thinking...');
    expect(container.textContent).toContain('9 s');
  });

  it('stops its timer when it unmounts', () => {
    const { unmount } = render(
      <ThinkingIndicator
        activity={liveActivity}
        startedAt={SENT_AT}
      />
    );
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('renders the steps in the viewer language', () => {
    setTestLocale('fr');
    const { container } = render(
      <ThinkingIndicator
        activity={liveActivity}
        startedAt={SENT_AT}
      />
    );

    expect(container.textContent).toContain('Lecture du résultat DeepCORO-JEPA enregistré');
    expect(container.textContent).toContain('Vérification des modèles ayant des résultats');
  });
});

describe('finished answer', () => {
  afterEach(() => setTestLocale('en-US'));

  it('shows a collapsed "Used N tools" line that expands to the steps with durations', () => {
    const { container } = render(<MessageBubble message={answer(finishedActivity)} />);

    const toggle = screen.getByRole('button', { name: /Used 5 tools/ });
    expect(toggle.textContent).toContain('Used 5 tools · 58 s');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-cy="chat-activity-steps"]')).toBeNull();
    expect(container.textContent).toContain('Here is the summary.');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const items = Array.from(container.querySelectorAll('[data-cy="chat-activity-steps"] li'));
    expect(items).toHaveLength(6);
    expect(items[0].textContent).toContain('Consulting the angiography specialist');
    expect(items[0].textContent).toContain('47 s');
    expect(items[1].textContent).toContain('<1 s');
    expect(items[4].textContent).toContain('Searching the web');
    expect(items[4].textContent).toContain('2 s');

    fireEvent.click(toggle);
    expect(container.querySelector('[data-cy="chat-activity-steps"]')).toBeNull();
  });

  it('marks failed steps in the summary line and in the list', () => {
    const { container } = render(<MessageBubble message={answer(finishedActivity)} />);
    const toggle = screen.getByRole('button');

    expect(toggle.textContent).toContain('1 failed');
    fireEvent.click(toggle);

    const failed = container.querySelector('li[data-status="failed"]');
    expect(failed?.textContent).toContain('Running DeepCORO-SCAD');
    expect(failed?.textContent).toContain('(failed)');
    expect(failed?.querySelector('[aria-label="Failed"]')?.textContent).toBe('✕');
    expect(container.querySelectorAll('li[data-status="done"] [aria-label="Failed"]')).toHaveLength(
      0
    );
  });

  it('uses the singular for one tool', () => {
    render(
      <MessageBubble
        message={answer({ elapsed_ms: 3200, steps: finishedActivity.steps.slice(1, 2) })}
      />
    );

    expect(screen.getByRole('button').textContent).toContain('Used 1 tool · 3 s');
  });

  it('shows nothing for an answer without activity (older backend) or without steps', () => {
    const { container, rerender } = render(<MessageBubble message={answer()} />);
    expect(container.querySelector('[data-cy="chat-activity-summary"]')).toBeNull();

    rerender(<MessageBubble message={answer({ elapsed_ms: 900, steps: [] })} />);
    expect(container.querySelector('[data-cy="chat-activity-summary"]')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('does not show the summary on user messages', () => {
    const { container } = render(
      <MessageBubble message={{ ...answer(finishedActivity), sender: 'user' }} />
    );
    expect(container.querySelector('[data-cy="chat-activity-summary"]')).toBeNull();
  });

  it('translates the summary line', () => {
    setTestLocale('fr');
    render(<MessageBubble message={answer(finishedActivity)} />);

    expect(screen.getByRole('button').textContent).toContain('5 outils utilisés · 58 s');
    expect(screen.getByRole('button').textContent).toContain('1 échec');
  });
});
