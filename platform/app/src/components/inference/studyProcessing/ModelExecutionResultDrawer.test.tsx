import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  modelExecutionResultFailureFixtures,
  modelExecutionResultFixtures,
} from './executionResultFixtures';
import {
  initialModelExecutionResultQueryState,
  modelExecutionResultQueryKey,
  type ModelExecutionResultQueryState,
} from './executionResultQuery';
import {
  getModelResultDrawerFocusableElements,
  ModelExecutionResultDrawer,
} from './ModelExecutionResultDrawer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      let translation = String(options.defaultValue ?? key);
      Object.entries(options).forEach(([name, value]) => {
        translation = translation.replace(`{{${name}}}`, String(value));
      });
      return translation;
    },
  }),
}));

const selection = {
  studyInstanceUID: modelExecutionResultFixtures.available.studyInstanceUID,
  runId: modelExecutionResultFixtures.available.runId,
  executionId: modelExecutionResultFixtures.available.executionId,
  modelName: modelExecutionResultFixtures.available.modelName,
  modelVersion: modelExecutionResultFixtures.available.modelVersion,
  status: 'completed' as const,
};

function queryState(
  overrides: Partial<ModelExecutionResultQueryState> = {}
): ModelExecutionResultQueryState {
  return {
    key: modelExecutionResultQueryKey(selection.runId, selection.executionId),
    selection,
    status: 'loading',
    result: null,
    failure: null,
    ...overrides,
  };
}

describe('ModelExecutionResultDrawer', () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('does not render before an explicit execution selection', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={initialModelExecutionResultQueryState}
          onClose={jest.fn()}
          onRetry={jest.fn()}
        />
      );
    });

    expect(renderer!.toJSON()).toBeNull();
  });

  test('opens an identified modal drawer in a polite loading state', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={queryState()}
          onClose={jest.fn()}
          onRetry={jest.fn()}
        />
      );
    });

    const drawer = renderer!.root.findByProps({
      'data-testid': 'model-execution-result-drawer',
    });
    const loading = renderer!.root.findByProps({
      'data-testid': 'model-execution-result-loading',
    });
    expect(drawer.props.role).toBe('dialog');
    expect(drawer.props['aria-modal']).toBe('true');
    expect(loading.props.role).toBe('status');
    expect(JSON.stringify(renderer!.toJSON())).toContain('CardioSyntax');
    expect(JSON.stringify(renderer!.toJSON())).toContain('v1.0.0');
    expect(JSON.stringify(renderer!.toJSON())).not.toContain('syntax_score');
  });

  test('closes from the button, Escape key, and backdrop', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={queryState()}
          onClose={onClose}
          onRetry={jest.fn()}
        />
      );
    });

    act(() => {
      renderer!.root.findByProps({ 'data-testid': 'model-execution-result-close' }).props.onClick();
      renderer!.root
        .findByProps({ 'data-testid': 'model-execution-result-drawer' })
        .props.onKeyDown({ key: 'Escape', preventDefault: jest.fn() });
      const overlay = renderer!.root.findByProps({
        'data-testid': 'model-execution-result-overlay',
      });
      overlay.props.onMouseDown({ target: overlay, currentTarget: overlay });
    });

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test('includes visible summary controls in the focus trap and excludes closed descendants', () => {
    const drawer = document.createElement('aside');
    drawer.innerHTML = `
      <button id="close">Close</button>
      <details>
        <summary id="root-summary">result</summary>
        <button id="hidden-button">hidden</button>
        <details>
          <summary id="nested-summary">nested</summary>
        </details>
      </details>
    `;

    expect(getModelResultDrawerFocusableElements(drawer).map(element => element.id)).toEqual([
      'close',
      'root-summary',
    ]);

    drawer.querySelector('details')?.setAttribute('open', '');
    expect(getModelResultDrawerFocusableElements(drawer).map(element => element.id)).toEqual([
      'close',
      'root-summary',
      'hidden-button',
      'nested-summary',
    ]);
  });

  test('shows completion context and generic data only from the correlated loaded result', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={queryState({ status: 'ready', result: modelExecutionResultFixtures.available })}
          onClose={jest.fn()}
          onRetry={jest.fn()}
        />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('2026');
    expect(rendered).toContain('syntax_score');
    expect(rendered).toContain('24.5');
  });

  test.each([
    [modelExecutionResultFailureFixtures.notReady, 'viewable completed result'],
    [modelExecutionResultFailureFixtures.terminalWithoutResult, 'missing'],
    [modelExecutionResultFailureFixtures.malformed, 'missing'],
    [modelExecutionResultFailureFixtures.forbidden, 'permission'],
    [modelExecutionResultFailureFixtures.notFound, 'unavailable'],
    [modelExecutionResultFailureFixtures.upstreamUnavailable, 'temporarily unavailable'],
  ])('shows operator-safe state for a normalized result failure', (failure, expectedCopy) => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={queryState({ status: 'error', failure })}
          onClose={jest.fn()}
          onRetry={jest.fn()}
        />
      );
    });

    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain(expectedCopy);
    expect(rendered).not.toMatch(/patient|credential|upstream body|job[_ -]?id/i);
  });

  test('offers retry only for a transient failure', () => {
    const onRetry = jest.fn();
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={queryState({
            status: 'error',
            failure: modelExecutionResultFailureFixtures.upstreamUnavailable,
          })}
          onClose={jest.fn()}
          onRetry={onRetry}
        />
      );
    });

    const retry = renderer!.root.findByProps({
      'data-testid': 'model-execution-result-retry',
    });
    act(() => retry.props.onClick());
    expect(onRetry).toHaveBeenCalledTimes(1);

    act(() => {
      renderer!.update(
        <ModelExecutionResultDrawer
          state={queryState({
            status: 'error',
            failure: modelExecutionResultFailureFixtures.notFound,
          })}
          onClose={jest.fn()}
          onRetry={onRetry}
        />
      );
    });
    expect(
      renderer!.root.findAllByProps({ 'data-testid': 'model-execution-result-retry' })
    ).toHaveLength(0);
  });

  test.each([
    ['empty object', modelExecutionResultFixtures.emptyObject],
    ['empty array', modelExecutionResultFixtures.emptyArray],
  ])('shows an intentional empty state for an %s result', (_label, result) => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={queryState({ status: 'ready', result })}
          onClose={jest.fn()}
          onRetry={jest.fn()}
        />
      );
    });

    expect(
      renderer!.root.findByProps({ 'data-testid': 'model-execution-result-empty' }).props.role
    ).toBe('status');
    expect(JSON.stringify(renderer!.toJSON())).toContain('contains no fields');
  });
});
