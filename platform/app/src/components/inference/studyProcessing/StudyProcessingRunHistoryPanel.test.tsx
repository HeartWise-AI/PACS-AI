import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { modelExecutionFixtures, studyProcessingRunHistoryFixture } from './fixtures';
import { StudyProcessingProvider } from './StudyProcessingProvider';
import { StudyProcessingRunHistoryPanel } from './StudyProcessingRunHistoryPanel';
import type {
  RunHistoryTransportResponse,
  StudyProcessingRunHistoryTransport,
} from './runHistoryTransport';

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

let renderer: ReactTestRenderer | null;

function renderPanel(transport: StudyProcessingRunHistoryTransport, studyInstanceUID = 'study-a') {
  renderer = TestRenderer.create(
    <StudyProcessingProvider runHistoryTransport={transport}>
      <StudyProcessingRunHistoryPanel studyInstanceUID={studyInstanceUID} />
    </StudyProcessingProvider>
  );
}

describe('StudyProcessingRunHistoryPanel', () => {
  beforeEach(() => {
    renderer = null;
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
  });

  test('loads history only for the mounted study', async () => {
    const loadRunHistory = jest.fn(async (studyInstanceUID: string) => ({
      history: {
        ...studyProcessingRunHistoryFixture,
        studyInstanceUID,
      },
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, 'requested-study');
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(1);
    expect(loadRunHistory).toHaveBeenCalledWith('requested-study');
  });

  test('shows a loading state while the first request is pending', () => {
    const loadRunHistory = jest.fn(() => new Promise<RunHistoryTransportResponse>(() => undefined));

    act(() => {
      renderPanel({ loadRunHistory });
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-run-history-loading',
      })
    ).toBeDefined();
  });

  test('shows partial history without hiding the available runs', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: true,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-run-history-partial',
      })
    ).toBeDefined();
    expect(renderer?.root.findAllByType('article')).toHaveLength(
      studyProcessingRunHistoryFixture.runs.length
    );
  });

  test('retries a failed initial request', async () => {
    const loadRunHistory = jest
      .fn()
      .mockRejectedValueOnce(new Error('Temporary failure.'))
      .mockResolvedValueOnce({
        history: studyProcessingRunHistoryFixture,
        partial: false,
      });

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    const retryButton = renderer?.root.findByProps({
      'data-testid': 'study-processing-run-history-retry',
    });

    await act(async () => {
      retryButton?.props.onClick();
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(2);
    expect(renderer?.root.findAllByType('article')).toHaveLength(
      studyProcessingRunHistoryFixture.runs.length
    );
  });

  test('opens the newest run by default and toggles runs independently', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    const newestRun = studyProcessingRunHistoryFixture.runs[0];
    const historicalRun = studyProcessingRunHistoryFixture.runs[1];
    const newestToggle = renderer?.root.findByProps({
      'data-testid': `study-processing-run-toggle-${newestRun.id}`,
    });
    const historicalToggle = renderer?.root.findByProps({
      'data-testid': `study-processing-run-toggle-${historicalRun.id}`,
    });

    expect(newestToggle?.props['aria-expanded']).toBe(true);
    expect(historicalToggle?.props['aria-expanded']).toBe(false);

    act(() => {
      historicalToggle?.props.onClick();
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': `study-processing-run-toggle-${newestRun.id}`,
      }).props['aria-expanded']
    ).toBe(true);
    expect(
      renderer?.root.findByProps({
        'data-testid': `study-processing-run-toggle-${historicalRun.id}`,
      }).props['aria-expanded']
    ).toBe(true);

    act(() => {
      renderer?.root
        .findByProps({
          'data-testid': `study-processing-run-toggle-${newestRun.id}`,
        })
        .props.onClick();
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': `study-processing-run-toggle-${newestRun.id}`,
      }).props['aria-expanded']
    ).toBe(false);
    expect(
      renderer?.root.findByProps({
        'data-testid': `study-processing-run-toggle-${historicalRun.id}`,
      }).props['aria-expanded']
    ).toBe(true);
  });

  test('explains that legacy model history cannot be reconstructed', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    const legacyRun = studyProcessingRunHistoryFixture.runs.find(
      run => run.trigger === 'LEGACY_IMPORT'
    );
    if (!legacyRun) {
      throw new Error('Legacy run fixture is required for this test.');
    }

    act(() => {
      renderer?.root
        .findByProps({
          'data-testid': `study-processing-run-toggle-${legacyRun.id}`,
        })
        .props.onClick();
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-legacy-history-message',
      })
    ).toBeDefined();
    expect(legacyRun.modelExecutions).toEqual([]);
  });

  test('shows readable attention reasons and safe structured errors', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    const activeRun = studyProcessingRunHistoryFixture.runs[0];
    const attention = renderer?.root.findByProps({
      'data-testid': `study-processing-run-attention-${activeRun.id}`,
    });
    const error = renderer?.root.findByProps({
      'data-testid': `study-processing-model-error-${modelExecutionFixtures.failed.id}`,
    });
    const renderedError = JSON.stringify(error?.children);

    expect(JSON.stringify(attention?.children)).toContain('Processing state reconciliation failed');
    expect(renderedError).toContain('Model execution failed');
    expect(renderedError).toContain('MODEL_EXECUTION_FAILED');
    expect(renderedError).not.toContain(modelExecutionFixtures.failed.error?.message);
  });

  test('shows both the readable skip message and structured skip code', async () => {
    const skippedRun = {
      ...studyProcessingRunHistoryFixture.runs[0],
      id: 'run-with-skipped-model',
      studyInstanceUID: 'study-with-skipped-model',
      attentionRequired: false,
      attentionReasons: [],
      expectedModels: 1,
      completedModels: 0,
      failedModels: 0,
      skippedModels: 1,
      modelExecutions: [modelExecutionFixtures.skipped],
    };
    const loadRunHistory = jest.fn(async () => ({
      history: {
        studyInstanceUID: 'study-with-skipped-model',
        runs: [skippedRun],
      },
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, 'study-with-skipped-model');
    });

    const skip = renderer?.root.findByProps({
      'data-testid': `study-processing-model-skip-${modelExecutionFixtures.skipped.id}`,
    });
    const renderedSkip = JSON.stringify(skip?.children);

    expect(renderedSkip).toContain('The model is not applicable to this study.');
    expect(renderedSkip).toContain('MODEL_NOT_APPLICABLE');
  });
});
