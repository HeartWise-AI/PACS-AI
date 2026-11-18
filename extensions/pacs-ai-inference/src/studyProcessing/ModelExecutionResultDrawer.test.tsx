import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
import { cardioSyntaxResultFixtures } from './modelResults/cardioSyntaxFixtures';
import { cathEfClipResultFixtures } from './modelResults/cathEfClipFixtures';
import { cathEfResultFixtures } from './modelResults/cathEfFixtures';
import { deepCoroClipResultFixtures } from './modelResults/deepCoroClipFixtures';
import { deepCoroCtoResultFixtures } from './modelResults/deepCoroCtoFixtures';
import { deepCoroMaceResultFixtures } from './modelResults/deepCoroMaceFixtures';
import { deepCoroSyntaxResultFixtures } from './modelResults/deepCoroSyntaxFixtures';
import { deepRVClipResultFixtures } from './modelResults/deepRVClipFixtures';
import { deepRVResultFixtures } from './modelResults/deepRVFixtures';

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

// Rendered text plus every attribute value (what the serialized render tree exposed).
function renderedContent(container: HTMLElement): string {
  const attributeValues = Array.from(container.querySelectorAll('*')).flatMap(element =>
    Array.from(element.attributes, attribute => attribute.value)
  );
  return [container.textContent ?? '', ...attributeValues].join('\n');
}

describe('ModelExecutionResultDrawer', () => {
  test('does not render before an explicit execution selection', () => {
    const { container } = render(
      <ModelExecutionResultDrawer
        state={initialModelExecutionResultQueryState}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.childNodes).toHaveLength(0);
  });

  test('opens an identified modal drawer in a polite loading state', () => {
    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState()}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    const drawer = screen.getByTestId('model-execution-result-drawer');
    const loading = screen.getByTestId('model-execution-result-loading');
    expect(drawer.getAttribute('role')).toBe('dialog');
    expect(drawer.getAttribute('aria-modal')).toBe('true');
    expect(loading.getAttribute('role')).toBe('status');
    expect(renderedContent(container)).toContain('CardioSyntax');
    expect(renderedContent(container)).toContain('v1.0.0');
    expect(renderedContent(container)).not.toContain('syntax_score');
  });

  test('closes from the button, Escape key, and backdrop', () => {
    const onClose = jest.fn();
    render(
      <ModelExecutionResultDrawer
        state={queryState()}
        onClose={onClose}
        onRetry={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('model-execution-result-close'));
    fireEvent.keyDown(screen.getByTestId('model-execution-result-drawer'), { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('model-execution-result-overlay'));

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
    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result: modelExecutionResultFixtures.available })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    const rendered = renderedContent(container);
    expect(rendered).toContain('2026');
    expect(rendered).toContain('syntax_score');
    expect(rendered).toContain('24.5');
  });

  test('selects the CardioSyntax renderer for an exact supported result', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      result: cardioSyntaxResultFixtures.validV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="cardiosyntax-result"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]')
    ).toHaveLength(0);
  });

  test('selects the CathEF renderer for an exact supported result', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      modelName: 'CathEF',
      modelVersion: '1.6.0',
      result: cathEfResultFixtures.withLvefV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="cathef-result"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]')
    ).toHaveLength(0);
  });

  test('selects the CathEF-CLIP renderer for an exact supported result', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      modelName: 'CathEF-CLIP',
      modelVersion: '1.0.0',
      result: cathEfClipResultFixtures.reducedV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="cathef-clip-result"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]')
    ).toHaveLength(0);
  });

  test('retains the generic renderer for an unsupported CardioSyntax version', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      modelVersion: '2.0.0',
      result: cardioSyntaxResultFixtures.validV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="cardiosyntax-result"]')).toHaveLength(0);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]').length
    ).toBeGreaterThan(0);
  });

  test('selects the DeepCORO-CLIP renderer for an exact supported result', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      modelName: 'DeepCORO-CLIP',
      modelVersion: '1.0.0',
      result: deepCoroClipResultFixtures.validV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="deepcoro-clip-result"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]')
    ).toHaveLength(0);
  });

  test('selects the DeepRV renderer for an exact supported result', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      modelName: 'DeepRV',
      modelVersion: '1.0.0',
      result: deepRVResultFixtures.validV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="deeprv-result"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]')
    ).toHaveLength(0);
  });

  test('selects the DeepRV-CLIP renderer for an exact supported result', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      modelName: 'DeepRV-CLIP',
      modelVersion: '1.0.0',
      result: deepRVClipResultFixtures.validV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="deeprv-clip-result"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]')
    ).toHaveLength(0);
  });

  test('selects the DeepCORO-MACE renderer for an exact supported result', () => {
    const result = {
      ...modelExecutionResultFixtures.available,
      modelName: 'DeepCORO-MACE',
      modelVersion: '1.0.0',
      result: deepCoroMaceResultFixtures.validV1,
    };

    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelectorAll('[data-testid="deepcoro-mace-result"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="generic-model-result-collection"]')
    ).toHaveLength(0);
  });

  test.each([
    ['DeepCORO-CTO', '2.0.0', deepCoroCtoResultFixtures.validV2, 'deepcoro-cto-result'],
    ['DeepCORO-SYNTAX', '5.0.0', deepCoroSyntaxResultFixtures.validV5, 'deepcoro-syntax-result'],
  ])(
    'selects the %s renderer for an exact supported result',
    (modelName, modelVersion, result, testId) => {
      const { container } = render(
        <ModelExecutionResultDrawer
          state={queryState({
            status: 'ready',
            result: {
              ...modelExecutionResultFixtures.available,
              modelName,
              modelVersion,
              result,
            },
          })}
          onClose={jest.fn()}
          onRetry={jest.fn()}
        />
      );

      expect(container.querySelectorAll(`[data-testid="${testId}"]`)).toHaveLength(1);
      expect(
        container.querySelectorAll('[data-testid="generic-model-result-collection"]')
      ).toHaveLength(0);
    }
  );

  test.each([
    [modelExecutionResultFailureFixtures.notReady, 'viewable completed result'],
    [modelExecutionResultFailureFixtures.terminalWithoutResult, 'missing'],
    [modelExecutionResultFailureFixtures.malformed, 'missing'],
    [modelExecutionResultFailureFixtures.forbidden, 'permission'],
    [modelExecutionResultFailureFixtures.notFound, 'unavailable'],
    [modelExecutionResultFailureFixtures.upstreamUnavailable, 'temporarily unavailable'],
  ])('shows operator-safe state for a normalized result failure', (failure, expectedCopy) => {
    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'error', failure })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    const rendered = renderedContent(container);
    expect(rendered).toContain(expectedCopy);
    expect(rendered).not.toMatch(/patient|credential|upstream body|job[_ -]?id/i);
  });

  test('offers retry only for a transient failure', () => {
    const onRetry = jest.fn();
    const { container, rerender } = render(
      <ModelExecutionResultDrawer
        state={queryState({
          status: 'error',
          failure: modelExecutionResultFailureFixtures.upstreamUnavailable,
        })}
        onClose={jest.fn()}
        onRetry={onRetry}
      />
    );

    const retry = screen.getByTestId('model-execution-result-retry');
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <ModelExecutionResultDrawer
        state={queryState({
          status: 'error',
          failure: modelExecutionResultFailureFixtures.notFound,
        })}
        onClose={jest.fn()}
        onRetry={onRetry}
      />
    );
    expect(container.querySelectorAll('[data-testid="model-execution-result-retry"]')).toHaveLength(
      0
    );
  });

  test.each([
    ['empty object', modelExecutionResultFixtures.emptyObject],
    ['empty array', modelExecutionResultFixtures.emptyArray],
  ])('shows an intentional empty state for an %s result', (_label, result) => {
    const { container } = render(
      <ModelExecutionResultDrawer
        state={queryState({ status: 'ready', result })}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByTestId('model-execution-result-empty').getAttribute('role')).toBe('status');
    expect(renderedContent(container)).toContain('contains no fields');
  });
});
