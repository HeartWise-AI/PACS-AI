import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { modelExecutionResultFixtures } from './executionResultFixtures';
import {
  initialModelExecutionResultQueryState,
  modelExecutionResultQueryKey,
  type ModelExecutionResultQueryState,
} from './executionResultQuery';
import { ModelExecutionResultDrawer } from './ModelExecutionResultDrawer';

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

  test('shows completion context only from the correlated loaded result', () => {
    act(() => {
      renderer = TestRenderer.create(
        <ModelExecutionResultDrawer
          state={queryState({ status: 'ready', result: modelExecutionResultFixtures.available })}
          onClose={jest.fn()}
          onRetry={jest.fn()}
        />
      );
    });

    expect(JSON.stringify(renderer!.toJSON())).toContain('Model result loaded.');
    expect(JSON.stringify(renderer!.toJSON())).toContain('2026');
    expect(JSON.stringify(renderer!.toJSON())).not.toContain('syntax_score');
  });
});
