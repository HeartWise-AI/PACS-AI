import React from 'react';
import { act, fireEvent, render as rtlRender, type RenderResult } from '@testing-library/react';
import english from '@pacs-ai/extension-core/src/locales/en-US/StudyBrowser.json';
import french from '@pacs-ai/extension-core/src/locales/fr/StudyBrowser.json';
import { StudyRefreshButton, type StudyRefreshButtonProps } from './StudyRefreshButton';
import type { StudyRefreshState } from './useStudyRefresh';

let mockStrings: Record<string, string> = english;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      (mockStrings[key] ?? String(options.defaultValue ?? key)).replace(
        /{{(\w+)}}/g,
        (_match: string, name: string) => String(options[name])
      ),
  }),
}));

const IDLE: StudyRefreshState = { phase: 'idle', progress: null, result: null, error: null };

function text(node: Element): string {
  return node.textContent ?? '';
}

describe('StudyRefreshButton', () => {
  let renderer: RenderResult | null = null;
  const onRefresh = jest.fn();

  function render(
    state: Partial<StudyRefreshState> = {},
    props: Partial<StudyRefreshButtonProps> = {}
  ) {
    renderer = rtlRender(
      <StudyRefreshButton
        state={{ ...IDLE, ...state }}
        onRefresh={onRefresh}
        {...props}
      />
    );
    return renderer.container;
  }

  const byTestId = (root: HTMLElement, id: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  // Exactly one matching element.
  const oneByTestId = (root: HTMLElement, id: string) => {
    const found = byTestId(root, id);
    expect(found).toHaveLength(1);
    return found[0];
  };
  const button = (root: HTMLElement) =>
    oneByTestId(root, 'study-refresh-button') as HTMLButtonElement;
  const status = (root: HTMLElement) => byTestId(root, 'study-refresh-status')[0] ?? null;

  beforeEach(() => {
    mockStrings = english;
    onRefresh.mockReset();
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  it('is an icon button with a tooltip that starts the refresh', () => {
    const root = render();

    expect(button(root).getAttribute('aria-label')).toBe('Refresh study from PACS');
    expect(button(root).getAttribute('title')).toBe('Refresh study from PACS');
    expect(button(root).disabled).toBe(false);
    expect(status(root)).toBeNull();
    expect(byTestId(root, 'study-refresh-growing')).toHaveLength(0);

    act(() => {
      fireEvent.click(button(root));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows the retrieval progress, or an indeterminate state, and is disabled meanwhile', () => {
    let root = render({ phase: 'retrieving', progress: 42 });
    expect(text(status(root))).toBe('Retrieving… 42%');
    expect(status(root).getAttribute('role')).toBe('status');
    expect(button(root).disabled).toBe(true);
    expect(button(root).getAttribute('aria-busy')).toBe('true');

    root = render({ phase: 'retrieving', progress: null });
    expect(text(status(root))).toBe('Retrieving…');
    root = render({ phase: 'resolving' });
    expect(text(status(root))).toBe('Retrieving…');
    root = render({ phase: 'reloading' });
    expect(text(status(root))).toBe('Loading series…');
    expect(button(root).disabled).toBe(true);
  });

  it('says what the refresh changed', () => {
    const done = (newSeries: number, newImages: number, retrievedFromPACS = true) =>
      text(status(render({ phase: 'done', result: { newSeries, newImages, retrievedFromPACS } })));

    expect(done(3, 3)).toBe('3 new series');
    expect(done(1, 4)).toBe('1 new series');
    expect(done(0, 2)).toBe('2 new images');
    expect(done(0, 1)).toBe('1 new image');
    expect(done(0, 0)).toBe('Up to date');
    expect(done(0, 0, false)).toBe('Up to date · local copy only (PACS source unknown)');
    expect(done(2, 2, false)).toBe('2 new series · local copy only (PACS source unknown)');
  });

  it('shows a clear error when the retrieval or the reload fails', () => {
    let root = render({ phase: 'error', error: 'retrieveFailed' });
    expect(status(root).getAttribute('role')).toBe('alert');
    expect(text(status(root))).toBe('Retrieval from the PACS failed');
    expect(button(root).disabled).toBe(false);

    root = render({
      phase: 'error',
      error: 'retrieveFailed',
      result: { newSeries: 2, newImages: 2, retrievedFromPACS: false },
    });
    expect(text(status(root))).toBe('Retrieval from the PACS failed · 2 new series');

    root = render({ phase: 'error', error: 'retrieveTimedOut' });
    expect(text(status(root))).toBe('Retrieval from the PACS is taking too long');
    root = render({ phase: 'error', error: 'reloadFailed' });
    expect(text(status(root))).toBe('The series could not be reloaded');
  });

  it('hints that the exam is still in progress', () => {
    let root = render({}, { growing: true });
    const dot = oneByTestId(root, 'study-refresh-growing');
    expect(dot.getAttribute('title')).toBe(
      'The exam is still in progress; new images may be available'
    );
    expect(button(root).getAttribute('title')).toBe(
      'Refresh study from PACS — The exam is still in progress; new images may be available'
    );

    root = render({ phase: 'retrieving' }, { growing: true });
    expect(byTestId(root, 'study-refresh-growing')).toHaveLength(0);
  });

  it('is translated to French', () => {
    mockStrings = french;

    let root = render({}, { growing: true });
    expect(button(root).getAttribute('aria-label')).toBe("Actualiser l'examen depuis le PACS");
    expect(oneByTestId(root, 'study-refresh-growing').getAttribute('title')).toBe(
      "L'examen est toujours en cours ; de nouvelles images peuvent être disponibles"
    );
    root = render({ phase: 'retrieving', progress: 42 });
    expect(text(status(root))).toBe('Récupération… 42 %');
    root = render({
      phase: 'done',
      result: { newSeries: 3, newImages: 3, retrievedFromPACS: true },
    });
    expect(text(status(root))).toBe('3 nouvelles séries');
    root = render({
      phase: 'done',
      result: { newSeries: 0, newImages: 0, retrievedFromPACS: true },
    });
    expect(text(status(root))).toBe('À jour');
    root = render({ phase: 'error', error: 'retrieveFailed' });
    expect(text(status(root))).toBe('Échec de la récupération depuis le PACS');
  });

  it('has every string in English and French', () => {
    const keys = Object.keys(english).filter(key => key.startsWith('RefreshStudy'));
    expect(keys).toHaveLength(14);
    keys.forEach(key => expect((french as Record<string, string>)[key]).toBeTruthy());
  });
});
