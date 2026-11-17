import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import { ChatCitationHostContext, type ChatCitationHost } from '../citations/ChatCitationHost';
import { setTestLocale } from '../testUtils/chatBoxTranslation';
import type { ChatCitation, Message } from '../types';

jest.mock('react-i18next', () => ({
  useTranslation: () => require('../testUtils/chatBoxTranslation').useTranslationMock(),
}));

const MODEL: ChatCitation = {
  index: 1,
  kind: 'model_result',
  modelName: 'DeepCORO-JEPA',
  modelVersion: '2.1.0',
  completedAt: '2026-11-13 09:00:00',
  studyInstanceUID: '2.25.9',
  studyServiceJobId: 'job-1',
  title: 'DeepCORO-JEPA',
  summary: 'Coronary reading: 2 significant stenosis segment(s), 1 occlusion(s)',
  outputMode: null,
};
const CTO: ChatCitation = {
  index: 2,
  kind: 'model_result',
  modelName: 'DeepCORO-CTO',
  modelVersion: '2.0.1',
  title: 'DeepCORO-CTO',
  summary: 'J-CTO 2 (RCA), difficult',
};
const SOURCE: ChatCitation = {
  index: 4,
  kind: 'web_source',
  title: '2024 ESC Guidelines for the management of chronic coronary syndromes',
  url: 'https://www.example.org/guideline?id=1',
};
const CITATIONS = [MODEL, CTO, SOURCE];

function message(text: string, citations?: ChatCitation[]): Message {
  return {
    id: 'assistant-message',
    sender: 'assistant',
    text,
    timestamp: new Date('2026-11-13T12:00:00Z'),
    ...(citations ? { citations } : {}),
  };
}

function renderMessage(text: string, citations?: ChatCitation[], host?: ChatCitationHost | null) {
  return render(
    <ChatCitationHostContext.Provider value={host ?? null}>
      <MessageBubble message={message(text, citations)} />
    </ChatCitationHostContext.Provider>
  );
}

const chips = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[data-cy="chat-citation-chip"]'));
const popover = () => document.querySelector<HTMLElement>('[data-cy="chat-citation-popover"]');

afterEach(() => setTestLocale('en-US'));

describe('citation markers in an answer', () => {
  it('renders the markers that have a citation as chips, in the middle of Markdown', () => {
    const { container } = renderMessage(
      [
        '**Coronary findings**',
        '- Significant stenosis: LAD 80% (severe) [1]',
        '- **J-CTO 2 (RCA), difficult [2]**',
        '',
        'Revascularization is reasonable [1][4].',
      ].join('\n'),
      CITATIONS
    );

    const found = chips(container);
    expect(found.map(chip => chip.textContent)).toEqual(['1', '2', '1', '4']);
    expect(found.map(chip => chip.getAttribute('aria-label'))).toEqual([
      'Source 1: DeepCORO-JEPA 2.1.0',
      'Source 2: DeepCORO-CTO 2.0.1',
      'Source 1: DeepCORO-JEPA 2.1.0',
      'Source 4: 2024 ESC Guidelines for the management of chronic coronary syndromes',
    ]);

    // Markdown is intact around the chips.
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].contains(found[0])).toBe(true);
    expect(items[0].textContent).toBe('Significant stenosis: LAD 80% (severe) 1');
    // A marker inside bold text.
    expect(items[1].querySelector('strong')?.contains(found[1])).toBe(true);
    // Adjacent markers.
    const paragraph = found[2].closest('p');
    expect(paragraph?.contains(found[3])).toBe(true);
    expect(paragraph?.textContent).toBe('Revascularization is reasonable 14.');
    expect(container.querySelector('strong')?.textContent).toBe('Coronary findings');
    expect(container.textContent).not.toContain('[1]');
  });

  it('leaves a marker without a citation, and ordinary brackets, as text', () => {
    const { container } = renderMessage(
      'Seen in [3] and [1]. Published [2024], range [0], list [12], [01], [a] and array[x].',
      [MODEL]
    );

    expect(chips(container).map(chip => chip.textContent)).toEqual(['1']);
    expect(container.textContent).toContain(
      'Seen in [3] and 1. Published [2024], range [0], list [12], [01], [a] and array[x].'
    );
  });

  it('leaves the markers of code and of links alone', () => {
    const { container } = renderMessage(
      'Inline `scores[1]` and a [link [1]](https://example.org) then [1].\n\n```\nrow[1]\n```',
      [MODEL]
    );

    expect(chips(container)).toHaveLength(1);
    expect(container.querySelector('code')?.textContent).toBe('scores[1]');
    expect(container.querySelector('pre')?.textContent).toContain('row[1]');
    expect(container.querySelector('a')?.textContent).toBe('link [1]');
  });

  it('keeps tables and headings working with chips in them', () => {
    const { container } = renderMessage(
      '#### Scores [2]\n\n| Score | Value |\n| --- | --- |\n| SYNTAX | 8.0 [1] |',
      CITATIONS
    );

    expect(
      container.querySelector('h4')?.querySelector('[data-cy="chat-citation-chip"]')
    ).not.toBeNull();
    expect(container.querySelectorAll('td')[1].textContent).toBe('8.0 1');
    expect(chips(container)).toHaveLength(2);
  });

  it('shows plain markers for a message without citations (old message, older backend)', () => {
    const { container } = renderMessage('LAD 80% (severe) [1]\n\n- J-CTO 2 [2]');

    expect(chips(container)).toHaveLength(0);
    expect(container.textContent).toContain('LAD 80% (severe) [1]');
    expect(container.textContent).toContain('J-CTO 2 [2]');
    expect(container.querySelector('sup')).toBeNull();
  });

  it('never makes chips in a user message', () => {
    const { container } = render(
      <MessageBubble message={{ ...message('see [1]', [MODEL]), sender: 'user' }} />
    );
    expect(chips(container)).toHaveLength(0);
    expect(container.textContent).toContain('see [1]');
  });
});

describe('citation popover', () => {
  function host(overrides: Partial<ReturnType<ChatCitationHost['resolveModelResult']>> = {}) {
    const open = jest.fn();
    const resolveModelResult = jest.fn(() => ({ open, loadRawResult: null, ...overrides }));
    return { open, resolveModelResult, host: { resolveModelResult } as ChatCitationHost };
  }

  it('shows a model result and opens that result in the viewer', () => {
    const viewer = host();
    const { container } = renderMessage('LAD 80% [1]', CITATIONS, viewer.host);
    const chip = chips(container)[0];
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(popover()).toBeNull();

    fireEvent.click(chip);

    const dialog = popover()!;
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Source 1: DeepCORO-JEPA 2.1.0');
    expect(dialog.textContent).toContain('AI model result');
    expect(dialog.textContent).toContain('DeepCORO-JEPA');
    expect(dialog.textContent).toContain('v2.1.0');
    expect(dialog.textContent).toContain('Completed 2026-11-13 09:00');
    expect(dialog.textContent).toContain(
      'Coronary reading: 2 significant stenosis segment(s), 1 occlusion(s)'
    );
    expect(viewer.resolveModelResult).toHaveBeenCalledWith(MODEL);
    // The viewer has no raw data accessor for this result: no such action.
    expect(within(dialog).queryByText('Raw result')).toBeNull();

    fireEvent.click(within(dialog).getByText('Open result'));

    expect(viewer.open).toHaveBeenCalledTimes(1);
    expect(popover()).toBeNull();
  });

  it('disables "Open result", with the reason, when the viewer does not hold the result', () => {
    const viewer = host({ open: null });
    const { container } = renderMessage('LAD 80% [1]', CITATIONS, viewer.host);
    fireEvent.click(chips(container)[0]);

    const action = within(popover()!).getByText('Open result');
    expect(action.getAttribute('aria-disabled')).toBe('true');
    expect(action.getAttribute('title')).toBe('This result is not available in the viewer');
    fireEvent.click(action);
    expect(viewer.open).not.toHaveBeenCalled();
    expect(popover()).not.toBeNull();
  });

  it('does the same outside a viewer (no host)', () => {
    const { container } = renderMessage('LAD 80% [1]', CITATIONS);
    fireEvent.click(chips(container)[0]);

    const action = within(popover()!).getByText('Open result');
    expect(action.getAttribute('aria-disabled')).toBe('true');
    expect(within(popover()!).queryByText('Raw result')).toBeNull();
  });

  it('shows the stored raw result on request, and hides it again', async () => {
    const loadRawResult = jest.fn().mockResolvedValue({ syntax_score: 8, vessels: ['LAD'] });
    const viewer = host({ loadRawResult });
    const { container } = renderMessage('LAD 80% [1]', CITATIONS, viewer.host);
    fireEvent.click(chips(container)[0]);
    const raw = within(popover()!).getByText('Raw result');
    expect(raw.getAttribute('aria-expanded')).toBe('false');
    expect(loadRawResult).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(raw);
    });

    expect(loadRawResult).toHaveBeenCalledTimes(1);
    expect(raw.getAttribute('aria-expanded')).toBe('true');
    const data = popover()!.querySelector('[data-cy="chat-citation-raw-data"]')!;
    expect(JSON.parse(data.textContent!)).toEqual({ syntax_score: 8, vessels: ['LAD'] });

    fireEvent.click(raw);
    expect(popover()!.querySelector('[data-cy="chat-citation-raw-data"]')).toBeNull();
  });

  it('says so when the raw result cannot be loaded', async () => {
    const viewer = host({ loadRawResult: jest.fn().mockRejectedValue(new Error('gone')) });
    const { container } = renderMessage('LAD 80% [1]', CITATIONS, viewer.host);
    fireEvent.click(chips(container)[0]);

    await act(async () => {
      fireEvent.click(within(popover()!).getByText('Raw result'));
    });

    expect(within(popover()!).getByRole('alert').textContent).toBe(
      'The raw result could not be loaded.'
    );
  });

  it('shows a published source with its title and an external link to its domain', () => {
    const viewer = host();
    const { container } = renderMessage('Evidence [4]', CITATIONS, viewer.host);
    fireEvent.click(chips(container)[0]);

    const dialog = popover()!;
    expect(dialog.textContent).toContain('Published source');
    expect(dialog.textContent).toContain(
      '2024 ESC Guidelines for the management of chronic coronary syndromes'
    );
    const link = dialog.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://www.example.org/guideline?id=1');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('example.org');
    expect(link.textContent).not.toContain('www.');
    expect(within(dialog).queryByText('Open result')).toBeNull();
    expect(viewer.resolveModelResult).not.toHaveBeenCalled();
  });

  it('does not link a source whose address is not a web link', () => {
    const { container } = renderMessage('Evidence [4]', [
      { index: 4, kind: 'web_source', title: 'Odd source', url: 'javascript:alert(1)' },
    ]);
    fireEvent.click(chips(container)[0]);

    expect(popover()!.querySelector('a')).toBeNull();
    expect(popover()!.textContent).toContain('Odd source');
  });

  it('is usable with the keyboard', () => {
    const viewer = host();
    const { container } = renderMessage('LAD 80% [1]', CITATIONS, viewer.host);
    const chip = chips(container)[0];

    // A chip is a button: focusable, and Enter / Space activate it natively.
    expect(chip.tagName).toBe('BUTTON');
    expect(chip.getAttribute('type')).toBe('button');
    expect(chip.tabIndex).toBe(0);
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog');
    chip.focus();
    fireEvent.click(chip);

    // Focus moves into the popover, whose actions are buttons too.
    expect(document.activeElement).toBe(popover());
    expect(within(popover()!).getByText('Open result').tagName).toBe('BUTTON');
    expect(within(popover()!).getByLabelText('Close').tagName).toBe('BUTTON');

    // Escape closes it and gives the focus back to the chip.
    fireEvent.keyDown(popover()!, { key: 'Escape' });
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(chip);

    fireEvent.click(chip);
    fireEvent.click(within(popover()!).getByLabelText('Close'));
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it('closes on a click elsewhere and toggles from its chip', () => {
    const { container } = renderMessage('LAD 80% [1] and CTO [2]', CITATIONS, host().host);
    const [first, second] = chips(container);

    fireEvent.click(first);
    fireEvent.mouseDown(popover()!);
    expect(popover()).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(popover()).toBeNull();

    fireEvent.click(first);
    fireEvent.mouseDown(first);
    fireEvent.click(first);
    expect(popover()).toBeNull();

    fireEvent.click(first);
    fireEvent.mouseDown(second);
    fireEvent.click(second);
    expect(document.querySelectorAll('[data-cy="chat-citation-popover"]')).toHaveLength(1);
    expect(popover()!.getAttribute('aria-label')).toBe('Source 2: DeepCORO-CTO 2.0.1');
  });

  it('keeps an open popover when the message is rendered again', () => {
    const view = renderMessage('LAD 80% [1]', CITATIONS, host().host);
    fireEvent.click(chips(view.container)[0]);
    const before = popover();

    view.rerender(
      <ChatCitationHostContext.Provider value={host().host}>
        <MessageBubble message={message('LAD 80% [1]', CITATIONS)} />
      </ChatCitationHostContext.Provider>
    );

    expect(popover()).toBe(before);
  });

  it('is in French', () => {
    setTestLocale('fr');
    const { container } = renderMessage(
      'LAD 80 % [1] et source [4]',
      CITATIONS,
      host({ open: null }).host
    );
    const [model, source] = chips(container);
    expect(model.getAttribute('aria-label')).toBe('Source 1 : DeepCORO-JEPA 2.1.0');

    fireEvent.click(model);
    expect(popover()!.textContent).toContain("Résultat de modèle d'IA");
    expect(popover()!.textContent).toContain('Terminé le 2026-11-13 09:00');
    const action = screen.getByText('Ouvrir le résultat');
    expect(action.getAttribute('title')).toBe(
      "Ce résultat n'est pas disponible dans la visionneuse"
    );
    expect(within(popover()!).getByLabelText('Fermer')).not.toBeNull();

    fireEvent.mouseDown(source);
    fireEvent.click(source);
    expect(popover()!.textContent).toContain('Source publiée');
  });
});

describe('citation popover and the results of the host', () => {
  it('tells the host a model result is shown and waits while it loads its results', () => {
    const onModelResultShown = jest.fn();
    const viewer: ChatCitationHost = {
      resolveModelResult: () => ({ open: null, loadRawResult: null, loading: true }),
      onModelResultShown,
    };
    const { container } = renderMessage('LAD 80% [1] and evidence [4]', CITATIONS, viewer);
    expect(onModelResultShown).not.toHaveBeenCalled();

    fireEvent.click(chips(container)[0]);

    expect(onModelResultShown).toHaveBeenCalledTimes(1);
    expect(onModelResultShown).toHaveBeenCalledWith(MODEL);
    const action = within(popover()!).getByText('Open result');
    expect(action.getAttribute('aria-disabled')).toBe('true');
    expect(action.getAttribute('aria-busy')).toBe('true');
    // Not "unavailable" yet: the host is still looking.
    expect(action.getAttribute('title')).toBeNull();

    fireEvent.mouseDown(chips(container)[1]);
    fireEvent.click(chips(container)[1]);
    expect(onModelResultShown).toHaveBeenCalledTimes(1);
  });

  it('enables "Open result" once the host holds the result', () => {
    const open = jest.fn();
    const view = renderMessage('LAD 80% [1]', CITATIONS, {
      resolveModelResult: () => ({ open: null, loading: true }),
    });
    fireEvent.click(chips(view.container)[0]);

    view.rerender(
      <ChatCitationHostContext.Provider value={{ resolveModelResult: () => ({ open }) }}>
        <MessageBubble message={message('LAD 80% [1]', CITATIONS)} />
      </ChatCitationHostContext.Provider>
    );

    const action = within(popover()!).getByText('Open result');
    expect(action.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(action);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
