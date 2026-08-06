import React from 'react';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { modelExecutionFixtures, studyProcessingRunHistoryFixture } from './fixtures';
import { StudyProcessingProvider } from './StudyProcessingProvider';
import { StudyProcessingRunHistoryPanel } from './StudyProcessingRunHistoryPanel';
import {
  RunHistoryUnavailableError,
  type RunHistoryTransportResponse,
  type StudyProcessingRunHistoryTransport,
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

function getRenderedText(node: ReactTestInstance | string): string {
  if (typeof node === 'string') {
    return node;
  }

  return node.children.map(getRenderedText).join(' ');
}

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

  test('does not load history while the study details remain collapsed', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    }));

    const renderStudyDetails = (expanded: boolean) => (
      <StudyProcessingProvider runHistoryTransport={{ loadRunHistory }}>
        {expanded ? (
          <StudyProcessingRunHistoryPanel studyInstanceUID="collapsed-study" />
        ) : (
          <React.Fragment />
        )}
      </StudyProcessingProvider>
    );

    act(() => {
      renderer = TestRenderer.create(renderStudyDetails(false));
    });

    expect(loadRunHistory).not.toHaveBeenCalled();

    await act(async () => {
      renderer?.update(renderStudyDetails(true));
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(1);
    expect(loadRunHistory).toHaveBeenCalledWith('collapsed-study');
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

  test('shows an empty state when the selected study has no runs', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: { studyInstanceUID: 'empty-study', runs: [] },
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, 'empty-study');
    });

    expect(getRenderedText(renderer!.root)).toContain('No processing runs yet.');
  });

  test('shows an unavailable state with a retry action', async () => {
    const loadRunHistory = jest.fn(async () => {
      throw new RunHistoryUnavailableError('Service unavailable.');
    });

    await act(async () => {
      renderPanel({ loadRunHistory }, 'unavailable-study');
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-run-history-error',
      })
    ).toBeDefined();
    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-run-history-retry',
      })
    ).toBeDefined();
    expect(getRenderedText(renderer!.root)).toContain(
      'Processing run history is currently unavailable.'
    );
  });

  test('does not offer retry for an authentication or permission failure', async () => {
    const loadRunHistory = jest.fn(async () => {
      throw new RunHistoryUnavailableError('Authentication is required.', false);
    });

    await act(async () => {
      renderPanel({ loadRunHistory }, 'unauthorized-study');
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-run-history-error',
      })
    ).toBeDefined();
    expect(
      renderer?.root.findAllByProps({
        'data-testid': 'study-processing-run-history-retry',
      })
    ).toHaveLength(0);
  });

  test('keeps cached runs visible while an explicit refresh is pending', async () => {
    let resolveRefresh!: (response: RunHistoryTransportResponse) => void;
    const loadRunHistory = jest
      .fn()
      .mockResolvedValueOnce({
        history: studyProcessingRunHistoryFixture,
        partial: false,
      })
      .mockImplementationOnce(
        () =>
          new Promise<RunHistoryTransportResponse>(resolve => {
            resolveRefresh = resolve;
          })
      );

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    act(() => {
      renderer?.root
        .findByProps({ 'data-testid': 'study-processing-run-history-refresh' })
        .props.onClick();
    });

    expect(renderer?.root.findAllByType('article')).toHaveLength(
      studyProcessingRunHistoryFixture.runs.length
    );
    expect(getRenderedText(renderer!.root)).toContain('Refreshing…');

    await act(async () => {
      resolveRefresh({
        history: studyProcessingRunHistoryFixture,
        partial: false,
      });
    });
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

  test('orders runs newest first even when the transport response is unordered', async () => {
    const unorderedHistory = {
      ...studyProcessingRunHistoryFixture,
      runs: [...studyProcessingRunHistoryFixture.runs].reverse(),
    };
    const loadRunHistory = jest.fn(async () => ({
      history: unorderedHistory,
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, unorderedHistory.studyInstanceUID);
    });

    const runToggles = renderer!.root.findAll(
      node =>
        typeof node.props['data-testid'] === 'string' &&
        node.props['data-testid'].startsWith('study-processing-run-toggle-')
    );

    expect(runToggles.map(toggle => toggle.props['data-testid'])).toEqual(
      studyProcessingRunHistoryFixture.runs.map(run => `study-processing-run-toggle-${run.id}`)
    );
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

  test('shows an available legacy execution snapshot without implying complete history', async () => {
    const legacyExecution = {
      ...modelExecutionFixtures.completed,
      id: 'legacy-snapshot-execution',
      modelName: 'LegacySnapshotModel',
    };
    const historyWithLegacySnapshot = {
      ...studyProcessingRunHistoryFixture,
      runs: studyProcessingRunHistoryFixture.runs.map(run =>
        run.trigger === 'LEGACY_IMPORT' ? { ...run, modelExecutions: [legacyExecution] } : run
      ),
    };
    const legacyRun = historyWithLegacySnapshot.runs.find(run => run.trigger === 'LEGACY_IMPORT');
    if (!legacyRun) {
      throw new Error('Legacy run fixture is required for this test.');
    }
    const loadRunHistory = jest.fn(async () => ({
      history: historyWithLegacySnapshot,
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, historyWithLegacySnapshot.studyInstanceUID);
    });

    act(() => {
      renderer?.root
        .findByProps({
          'data-testid': `study-processing-run-toggle-${legacyRun.id}`,
        })
        .props.onClick();
    });

    const legacyMessage = renderer?.root.findByProps({
      'data-testid': 'study-processing-legacy-history-message',
    });
    expect(getRenderedText(legacyMessage!)).toContain('available execution snapshot');
    expect(getRenderedText(renderer!.root)).toContain('LegacySnapshotModel');
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
    const renderedAttention = attention ? getRenderedText(attention) : '';
    const renderedError = error ? getRenderedText(error) : '';

    expect(renderedAttention).toContain('Processing state reconciliation failed');
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
    const renderedSkip = skip ? getRenderedText(skip) : '';

    expect(renderedSkip).toContain('The model is not applicable to this study.');
    expect(renderedSkip).toContain('MODEL_NOT_APPLICABLE');
  });

  test('shows a safe fallback for an unknown future skip code', async () => {
    const futureSkippedExecution = {
      ...modelExecutionFixtures.skipped,
      id: 'future-skipped-execution',
      skipReason: {
        code: 'FUTURE_BACKEND_SKIP_REASON',
        message: null,
      },
    };
    const skippedRun = {
      ...studyProcessingRunHistoryFixture.runs[0],
      id: 'run-with-future-skip-reason',
      studyInstanceUID: 'study-with-future-skip-reason',
      expectedModels: 1,
      completedModels: 0,
      failedModels: 0,
      skippedModels: 1,
      modelExecutions: [futureSkippedExecution],
    };
    const loadRunHistory = jest.fn(async () => ({
      history: {
        studyInstanceUID: skippedRun.studyInstanceUID,
        runs: [skippedRun],
      },
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, skippedRun.studyInstanceUID);
    });

    const skip = renderer?.root.findByProps({
      'data-testid': `study-processing-model-skip-${futureSkippedExecution.id}`,
    });
    const renderedSkip = skip ? getRenderedText(skip) : '';

    expect(renderedSkip).toContain('Model was skipped');
    expect(renderedSkip).toContain('FUTURE_BACKEND_SKIP_REASON');
  });

  test('renders every supported model execution status in mixed history', async () => {
    const statuses = [
      'pending',
      'queued',
      'running',
      'completed',
      'failed',
      'skipped',
      'cancelled',
    ] as const;
    const mixedRun = {
      ...studyProcessingRunHistoryFixture.runs[0],
      id: 'mixed-outcome-run',
      studyInstanceUID: 'mixed-outcome-study',
      expectedModels: statuses.length,
      modelExecutions: statuses.map(status => ({
        ...modelExecutionFixtures.completed,
        id: `execution-${status}`,
        status,
        error: status === 'failed' ? modelExecutionFixtures.failed.error : null,
        skipReason: status === 'skipped' ? modelExecutionFixtures.skipped.skipReason : null,
      })),
    };
    const loadRunHistory = jest.fn(async () => ({
      history: {
        studyInstanceUID: mixedRun.studyInstanceUID,
        runs: [mixedRun],
      },
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, mixedRun.studyInstanceUID);
    });

    const renderedPanel = getRenderedText(renderer!.root);
    statuses.forEach(status => expect(renderedPanel).toContain(status));
  });
});
