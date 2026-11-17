import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';
import {
  useViewerModelResults,
  ViewerModelResultsProvider,
  type ForegroundRunOutcome,
  type ViewerModelResultsContextValue,
  type ViewerModelResultsProviderProps,
} from './ViewerModelResultsProvider';
import { ViewerResultsRequestError, type ViewerResultsRepository } from './viewerResultsRepository';
import type { ViewerModelResult } from './types';

const mockInferenceProcessing = {
  canViewStudyProcessingRunHistory: true,
  canUseStudyProcessingREST: true,
};

jest.mock('@pacs-ai/extension-core/src/inferenceProcessing/InferenceProcessingProvider', () => ({
  useOptionalInferenceProcessing: () => mockInferenceProcessing,
}));

jest.mock('./ViewerModelResultDrawer', () => ({
  __esModule: true,
  default: ({ result, seriesScope }: { result: ViewerModelResult; seriesScope?: unknown }) => (
    <div
      data-testid="drawer"
      data-series-scope={seriesScope}
    >
      {result.modelName}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      options.modelName ? `${key}:${options.modelName}` : key,
  }),
}));

const model = {
  modelId: 'deepcoro-jepa',
  containerId: 'container-1',
  modelName: 'DeepCORO-JEPA',
  version: '1.3.0',
};

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '1.3.0',
    modality: 'angiogram',
    modelId: 'model-1',
    artifactModelId: 'deepcoro-jepa',
    containerId: 'container-1',
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: 'job-1',
    completedAt: '2026-11-10T10:00:00Z',
    trigger: 'AUTO',
    selectedViews: [
      {
        sopInstanceUID: 'sop-2',
        seriesInstanceUID: 'series-1',
        viewLabel: 'LAO cranial',
        order: 0,
        role: 'diagnostic',
        extra: null,
      },
    ],
    reportAvailable: true,
    ...overrides,
  };
}

function repository(overrides: Partial<ViewerResultsRepository> = {}) {
  return {
    loadLatestResults: jest.fn().mockResolvedValue([result()]),
    loadReport: jest.fn(),
    runModel: jest.fn(),
    loadRunStatus: jest
      .fn()
      .mockResolvedValue({ phase: 'PROCESSING', outcome: null, executions: [] }),
    ...overrides,
  } as jest.Mocked<ViewerResultsRepository>;
}

function services() {
  const doubleClick = jest.fn();
  const callbackFactory = jest.fn(() => doubleClick);
  return {
    doubleClick,
    callbackFactory,
    servicesManager: {
      services: {
        displaySetService: {
          getActiveDisplaySets: () => [
            {
              displaySetInstanceUID: 'ds-1',
              SeriesInstanceUID: 'series-1',
              instances: [{ SOPInstanceUID: 'sop-1' }],
            },
            {
              displaySetInstanceUID: 'ds-2',
              SeriesInstanceUID: 'series-1',
              instances: [{ SOPInstanceUID: 'sop-2' }],
            },
          ],
        },
        viewportGridService: {
          getState: () => ({ activeViewportId: 'viewport-1', isHangingProtocolLayout: false }),
        },
        customizationService: {
          getCustomization: () => ({ callbacks: [callbackFactory] }),
        },
      },
    } as unknown as AppTypes.ServicesManager,
  };
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

describe('ViewerModelResultsProvider', () => {
  let renderer: ReactTestRenderer | null = null;
  let context: ViewerModelResultsContextValue | null = null;
  const showAlert = jest.fn();

  function Probe() {
    context = useViewerModelResults();
    return null;
  }

  async function render(
    repo: ViewerResultsRepository,
    servicesManager = services().servicesManager,
    props: Partial<ViewerModelResultsProviderProps> = {}
  ) {
    await act(async () => {
      renderer = TestRenderer.create(
        <AlertContext.Provider value={showAlert}>
          <ViewerModelResultsProvider
            studyInstanceUID="1.2.3"
            servicesManager={servicesManager}
            repository={repo}
            pollIntervalMs={1000}
            {...props}
          >
            <Probe />
          </ViewerModelResultsProvider>
        </AlertContext.Provider>
      );
    });
  }

  beforeEach(() => {
    mockInferenceProcessing.canViewStudyProcessingRunHistory = true;
    mockInferenceProcessing.canUseStudyProcessingREST = true;
    showAlert.mockReset();
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    context = null;
    jest.useRealTimers();
  });

  test('loads the latest results and matches them to available models', async () => {
    const repo = repository();
    await render(repo);

    await act(async () => {
      await context!.refreshLatestResults();
    });

    expect(repo.loadLatestResults).toHaveBeenCalledWith('1.2.3');
    expect(context!.latestResultsStatus).toBe('ready');
    expect(context!.getLatestResult(model)?.runId).toBe('run-1');
    expect(context!.getLatestResult({ modelName: 'EchoPrime' })).toBeNull();
  });

  test('treats a missing latest-results endpoint as no stored results', async () => {
    const repo = repository({
      loadLatestResults: jest.fn().mockRejectedValue(new ViewerResultsRequestError('x', 404)),
    });
    await render(repo);

    await act(async () => {
      await context!.refreshLatestResults();
    });

    expect(context!.latestResultsStatus).toBe('unavailable');
    expect(context!.getLatestResult(model)).toBeNull();
  });

  test('does nothing when run history is not available to the user', async () => {
    mockInferenceProcessing.canViewStudyProcessingRunHistory = false;
    const repo = repository();
    await render(repo);

    await act(async () => {
      await context!.refreshLatestResults();
    });

    expect(repo.loadLatestResults).not.toHaveBeenCalled();
    expect(context!.canViewResults).toBe(false);
  });

  test('falls back to interactive predict when the run endpoint is absent', async () => {
    const repo = repository({
      runModel: jest.fn().mockRejectedValue(new ViewerResultsRequestError('x', 501)),
    });
    await render(repo);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await context!.startManagedRun({ model, modality: 'XA' });
    });

    expect(outcome).toBe('fallback');
    expect(context!.getPendingRun(model)).toBeNull();
  });

  test('falls back without calling the API when managed runs are disabled', async () => {
    mockInferenceProcessing.canUseStudyProcessingREST = false;
    const repo = repository();
    await render(repo);

    await expect(context!.startManagedRun({ model })).resolves.toBe('fallback');
    expect(repo.runModel).not.toHaveBeenCalled();
  });

  test('reports an already active run and tracks it as in progress', async () => {
    const repo = repository({
      runModel: jest
        .fn()
        .mockRejectedValue(new ViewerResultsRequestError('x', 409, 'RUN_ALREADY_ACTIVE')),
    });
    await render(repo);

    await act(async () => {
      await expect(context!.startManagedRun({ model })).rejects.toMatchObject({
        message: 'ViewerRunAlreadyActive',
      });
    });
    expect(context!.getPendingRun(model)).toMatchObject({ runId: null, executionId: null });
  });

  test.each([
    [
      new ViewerResultsRequestError('x', 409, 'STUDY_NOT_AVAILABLE_LOCALLY'),
      'ViewerStudyNotAvailableLocally',
    ],
    [new ViewerResultsRequestError('x', 429, 'INFERENCE_QUOTA_EXCEEDED'), 'ViewerRunQuotaExceeded'],
    [new ViewerResultsRequestError('x', 404, 'MISSING_RECORD', 'Not found.'), 'Not found.'],
    [new ViewerResultsRequestError('x', 503, null), 'ViewerRunFailed'],
  ])('does not fall back on coded run errors (%#)', async (error, message) => {
    const repo = repository({ runModel: jest.fn().mockRejectedValue(error) });
    await render(repo);

    await expect(context!.startManagedRun({ model })).rejects.toMatchObject({ message });
    expect(context!.getPendingRun(model)).toBeNull();
  });

  test('queues a managed run and offers the newer result once it completes', async () => {
    jest.useFakeTimers();
    const repo = repository({
      runModel: jest.fn().mockResolvedValue({
        runId: 'run-2',
        runNumber: 2,
        trigger: 'VIEWER_REQUEST',
        executionId: 'execution-2',
        modelName: 'DeepCORO-JEPA',
        modelVersion: '1.3.0',
      }),
    });
    await render(repo);
    await act(async () => {
      await context!.refreshLatestResults();
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await context!.startManagedRun({ model, modality: 'XA' });
    });

    expect(outcome).toBe('queued');
    expect(repo.runModel).toHaveBeenCalledWith({
      studyInstanceUID: '1.2.3',
      modelRef: 'container-1',
      modality: 'XA',
    });
    expect(showAlert).toHaveBeenCalledWith('ViewerRunQueued:DeepCORO-JEPA', 'info');
    expect(context!.getPendingRun(model)?.runId).toBe('run-2');

    // First poll: still the previous result.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    expect(context!.getPendingRun(model)).not.toBeNull();

    const newer = result({
      runId: 'run-2',
      executionId: 'execution-2',
      completedAt: '2026-11-13T10:00:00Z',
      trigger: 'VIEWER_REQUEST',
    });
    repo.loadLatestResults.mockResolvedValue([newer]);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await flush();

    expect(context!.getPendingRun(model)).toBeNull();
    expect(context!.getLatestResult(model)?.runId).toBe('run-2');
    const notice = renderer!.root.findByProps({ 'data-testid': 'viewer-model-result-ready-view' });
    await act(async () => {
      notice.props.onClick();
    });
    expect(context!.openedResult?.result.runId).toBe('run-2');
    expect(renderer!.root.findByProps({ 'data-testid': 'drawer' })).toBeTruthy();
  });

  test('opens, minimizes and closes a result', async () => {
    await render(repository());

    act(() => context!.openResult(result()));
    expect(context!.openedResult).toEqual({ result: result(), minimized: false });
    expect(renderer!.root.findAllByProps({ 'data-testid': 'drawer' })).toHaveLength(1);

    act(() => context!.setResultMinimized(true));
    expect(context!.openedResult?.minimized).toBe(true);
    expect(renderer!.root.findAllByProps({ 'data-testid': 'drawer' })).toHaveLength(0);

    act(() => context!.closeResult());
    expect(context!.openedResult).toBeNull();
  });

  test('resolves the series scope of a result from the loaded display sets', async () => {
    const listeners: Array<() => void> = [];
    const unsubscribe = jest.fn();
    const displaySets = ['series-1', 'series-2'].map(uid => ({
      StudyInstanceUID: '1.2.3',
      SeriesInstanceUID: uid,
      Modality: 'XA',
      isMultiFrame: true,
    }));
    const servicesManager = {
      services: {
        displaySetService: {
          EVENTS: { DISPLAY_SETS_ADDED: 'added' },
          getActiveDisplaySets: () => displaySets,
          subscribe: jest.fn((_event: string, listener: () => void) => {
            listeners.push(listener);
            return { unsubscribe };
          }),
        },
      },
    } as unknown as AppTypes.ServicesManager;
    await render(repository(), servicesManager);
    const subset = result({ dispatchSeriesInstanceUIDs: ['series-1'] });

    expect(context!.getResultSeriesScope(result())).toBeNull();
    expect(context!.getResultSeriesScope(result({ dispatchSeriesInstanceUIDs: null }))).toEqual({
      kind: 'all',
      series: [],
    });
    expect(context!.getResultSeriesScope(subset)).toMatchObject({
      kind: 'subset',
      used: 1,
      total: 2,
    });

    act(() => context!.openResult(subset));
    const drawer = () => renderer!.root.findByProps({ 'data-testid': 'drawer' });
    expect(drawer().props['data-series-scope']).toMatchObject({ kind: 'subset', total: 2 });

    // Series that finish loading while the drawer is open update the scope.
    displaySets.push({ ...displaySets[0], SeriesInstanceUID: 'series-3' });
    act(() => listeners.forEach(listener => listener()));
    expect(drawer().props['data-series-scope']).toMatchObject({ kind: 'subset', total: 3 });

    act(() => context!.closeResult());
    expect(unsubscribe).toHaveBeenCalled();
  });

  test('loads a selected view through the thumbnail double-click behaviour', async () => {
    const system = services();
    await render(repository(), system.servicesManager);

    let loaded = false;
    await act(async () => {
      loaded = context!.loadSelectedView(result().selectedViews![0]);
    });

    expect(loaded).toBe(true);
    expect(system.callbackFactory).toHaveBeenCalledWith(
      expect.objectContaining({ activeViewportId: 'viewport-1', isHangingProtocolLayout: false })
    );
    expect(system.doubleClick).toHaveBeenCalledWith('ds-2');

    let missing = true;
    act(() => {
      missing = context!.loadSelectedView({
        ...result().selectedViews![0],
        sopInstanceUID: 'x',
        seriesInstanceUID: null,
      });
    });
    expect(missing).toBe(false);
    expect(showAlert).toHaveBeenCalledWith('ViewerSelectedViewNotLoaded', 'info');
  });

  describe('foreground runs', () => {
    const startedRun = {
      runId: 'run-2',
      runNumber: 2,
      trigger: 'VIEWER_REQUEST',
      executionId: 'execution-2',
      modelName: 'DeepCORO-JEPA',
      modelVersion: '1.3.0',
    };
    const newer = result({
      runId: 'run-2',
      executionId: 'execution-2',
      completedAt: '2026-11-13T10:00:00Z',
      trigger: 'VIEWER_REQUEST',
    });
    const readyNotices = () =>
      renderer!.root.findAllByProps({ 'data-testid': 'viewer-model-result-ready-view' });
    const tick = async (milliseconds: number) => {
      await act(async () => {
        jest.advanceTimersByTime(milliseconds);
      });
      await flush();
      await flush();
    };

    async function start(
      repo: ViewerResultsRepository,
      props: Partial<ViewerModelResultsProviderProps> = {}
    ) {
      jest.useFakeTimers();
      await render(repo, undefined, props);
      await act(async () => {
        await context!.refreshLatestResults();
      });
      let outcome: ForegroundRunOutcome | undefined;
      await act(async () => {
        void context!
          .startForegroundRun({
            model,
            modality: 'XA',
            seriesInstanceUIDs: ['series-1', 'series-2'],
            studyInstanceUID: '1.2.3',
          })
          .then(settled => {
            outcome = settled;
          });
      });
      return () => outcome;
    }

    test('sends the selected series, waits without a toast and opens the result when ready', async () => {
      const repo = repository({ runModel: jest.fn().mockResolvedValue(startedRun) });
      const outcome = await start(repo);

      expect(repo.runModel).toHaveBeenCalledWith({
        studyInstanceUID: '1.2.3',
        modelRef: 'container-1',
        modality: 'XA',
        seriesInstanceUIDs: ['series-1', 'series-2'],
      });
      expect(showAlert).not.toHaveBeenCalled();
      expect(context!.getPendingRun(model)?.runId).toBe('run-2');

      await tick(1000);
      expect(outcome()).toBeUndefined();
      expect(repo.loadRunStatus).toHaveBeenCalledWith('run-2');

      repo.loadLatestResults.mockResolvedValue([newer]);
      await tick(1000);

      expect(outcome()).toEqual({ status: 'completed', result: newer });
      expect(context!.getPendingRun(model)).toBeNull();
      expect(context!.openedResult).toEqual({ result: newer, minimized: false });
      expect(renderer!.root.findAllByProps({ 'data-testid': 'drawer' })).toHaveLength(1);
      expect(readyNotices()).toHaveLength(0);
      expect(showAlert).not.toHaveBeenCalled();
    });

    test('runs the study chosen in the series pop-up', async () => {
      const repo = repository({ runModel: jest.fn().mockResolvedValue(startedRun) });
      jest.useFakeTimers();
      await render(repo);
      await act(async () => {
        void context!.startForegroundRun({ model, studyInstanceUID: '9.9.9' });
      });

      expect(repo.runModel).toHaveBeenCalledWith({
        studyInstanceUID: '9.9.9',
        modelRef: 'container-1',
        modality: undefined,
      });
      await tick(1000);
      expect(repo.loadLatestResults).toHaveBeenCalledWith('9.9.9');
    });

    test('polls faster while a foreground run is active', async () => {
      const repo = repository({ runModel: jest.fn().mockResolvedValue(startedRun) });
      await start(repo, { pollIntervalMs: 10_000 });
      repo.loadLatestResults.mockClear();

      await tick(3000);
      expect(repo.loadLatestResults).toHaveBeenCalledTimes(1);

      act(() => context!.dismissForegroundRun());
      await tick(3000);
      expect(repo.loadLatestResults).toHaveBeenCalledTimes(1);
      await tick(7000);
      expect(repo.loadLatestResults).toHaveBeenCalledTimes(2);
    });

    test('keeps a dismissed run tracked and offers its result through the notice', async () => {
      const repo = repository({ runModel: jest.fn().mockResolvedValue(startedRun) });
      const outcome = await start(repo);

      await act(async () => {
        context!.dismissForegroundRun();
      });
      expect(outcome()).toEqual({ status: 'dismissed' });
      expect(context!.getPendingRun(model)?.runId).toBe('run-2');

      repo.loadLatestResults.mockResolvedValue([newer]);
      await tick(1000);

      expect(context!.getPendingRun(model)).toBeNull();
      expect(context!.openedResult).toBeNull();
      expect(readyNotices()).toHaveLength(1);
    });

    test('does not wait on a run dismissed before its start request returned', async () => {
      let resolveRun: (run: typeof startedRun) => void = () => {};
      const repo = repository({
        runModel: jest.fn().mockReturnValue(
          new Promise(resolve => {
            resolveRun = resolve;
          })
        ),
      });
      const outcome = await start(repo);

      act(() => context!.dismissForegroundRun());
      await act(async () => {
        resolveRun(startedRun);
      });

      expect(outcome()).toEqual({ status: 'dismissed' });
      expect(context!.getPendingRun(model)?.runId).toBe('run-2');
    });

    test.each([
      ['failed', 'ViewerRunEndedFailed:DeepCORO-JEPA'],
      ['skipped', 'ViewerRunEndedSkipped:DeepCORO-JEPA'],
    ])('stops waiting when the run ends %s', async (status, message) => {
      const repo = repository({
        runModel: jest.fn().mockResolvedValue(startedRun),
        loadRunStatus: jest.fn().mockResolvedValue({
          phase: 'TERMINAL',
          outcome: 'FAILED',
          executions: [{ executionId: 'execution-2', status }],
        }),
      });
      const outcome = await start(repo);

      await tick(1000);

      expect(outcome()).toEqual({ status: 'failed' });
      expect(showAlert).toHaveBeenCalledWith(message, 'error');
      expect(context!.getPendingRun(model)).toBeNull();
      expect(context!.openedResult).toBeNull();
      expect(readyNotices()).toHaveLength(0);
    });

    test('keeps waiting when the run status cannot be loaded', async () => {
      const repo = repository({
        runModel: jest.fn().mockResolvedValue(startedRun),
        loadRunStatus: jest.fn().mockRejectedValue(new ViewerResultsRequestError('x', 404)),
      });
      const outcome = await start(repo);

      await tick(1000);

      expect(outcome()).toBeUndefined();
      expect(context!.getPendingRun(model)?.runId).toBe('run-2');
    });

    test('stops waiting when the run exceeds the maximum pending time', async () => {
      const repo = repository({ runModel: jest.fn().mockResolvedValue(startedRun) });
      const outcome = await start(repo, { maxPendingMs: 1500 });

      await tick(1000);
      expect(outcome()).toBeUndefined();
      await tick(1000);

      expect(outcome()).toEqual({ status: 'timedOut' });
      expect(showAlert).toHaveBeenCalledWith('ViewerRunStillRunning:DeepCORO-JEPA', 'info');
      expect(context!.getPendingRun(model)).toBeNull();
    });

    test('reports a failed background run as well', async () => {
      const repo = repository({
        runModel: jest.fn().mockResolvedValue(startedRun),
        loadRunStatus: jest.fn().mockResolvedValue({
          phase: 'TERMINAL',
          outcome: 'FAILED',
          executions: [{ executionId: 'execution-2', status: 'failed' }],
        }),
      });
      jest.useFakeTimers();
      await render(repo);
      await act(async () => {
        await context!.startManagedRun({ model });
      });

      await tick(1000);

      expect(showAlert).toHaveBeenCalledWith('ViewerRunEndedFailed:DeepCORO-JEPA', 'error');
      expect(context!.getPendingRun(model)).toBeNull();
    });

    describe('running jobs indicator', () => {
      const jobRows = () => renderer!.root.findAllByProps({ 'data-testid': 'running-jobs-row' });
      const jobStates = () => jobRows().map(row => row.props['data-state']);

      test('is hidden while the pop-up waits on the run and shows it once dismissed', async () => {
        const repo = repository({
          runModel: jest.fn().mockResolvedValue(startedRun),
          loadRunStatus: jest.fn().mockResolvedValue({
            phase: 'PROCESSING',
            outcome: null,
            executions: [{ executionId: 'execution-2', status: 'running' }],
          }),
        });
        await start(repo);
        expect(jobRows()).toHaveLength(0);
        await tick(1000);
        expect(jobRows()).toHaveLength(0);

        await act(async () => {
          context!.dismissForegroundRun();
        });
        expect(jobStates()).toEqual(['running']);

        repo.loadLatestResults.mockResolvedValue([newer]);
        await tick(1000);
        expect(jobStates()).toEqual(['done']);
        expect(readyNotices()).toHaveLength(1);

        // The finished row opens the result like the ready notice does.
        await act(async () => {
          renderer!.root.findByProps({ 'data-testid': 'running-jobs-open-result' }).props.onClick();
        });
        expect(context!.openedResult?.result.runId).toBe('run-2');
        expect(readyNotices()).toHaveLength(0);

        await tick(6000);
        expect(jobRows()).toHaveLength(0);
      });

      test('does not repeat a result the pop-up opened itself', async () => {
        const repo = repository({ runModel: jest.fn().mockResolvedValue(startedRun) });
        const outcome = await start(repo);
        repo.loadLatestResults.mockResolvedValue([newer]);
        await tick(1000);

        expect(outcome()).toMatchObject({ status: 'completed' });
        expect(jobRows()).toHaveLength(0);
      });

      test('shows a background run from queued to failed', async () => {
        const repo = repository({
          runModel: jest.fn().mockResolvedValue(startedRun),
          loadRunStatus: jest.fn().mockResolvedValue({
            phase: 'QUEUED',
            outcome: null,
            executions: [{ executionId: 'execution-2', status: 'queued' }],
          }),
        });
        jest.useFakeTimers();
        await render(repo);
        await act(async () => {
          await context!.startManagedRun({ model });
        });
        expect(jobStates()).toEqual(['queued']);

        repo.loadRunStatus.mockResolvedValue({
          phase: 'PROCESSING',
          outcome: null,
          executions: [{ executionId: 'execution-2', status: 'running' }],
        });
        await tick(1000);
        expect(jobStates()).toEqual(['running']);

        repo.loadRunStatus.mockResolvedValue({
          phase: 'TERMINAL',
          outcome: 'FAILED',
          executions: [{ executionId: 'execution-2', status: 'failed' }],
        });
        await tick(1000);
        expect(jobStates()).toEqual(['failed']);
        expect(showAlert).toHaveBeenCalledWith('ViewerRunEndedFailed:DeepCORO-JEPA', 'error');
      });
    });

    test('rejects with the start error and falls back like a queued run', async () => {
      const repo = repository({
        runModel: jest
          .fn()
          .mockRejectedValueOnce(
            new ViewerResultsRequestError('x', 429, 'INFERENCE_QUOTA_EXCEEDED')
          )
          .mockRejectedValueOnce(new ViewerResultsRequestError('x', 409, 'RUN_ALREADY_ACTIVE'))
          .mockRejectedValueOnce(new ViewerResultsRequestError('x', 501)),
      });
      await render(repo);

      await act(async () => {
        await expect(context!.startForegroundRun({ model })).rejects.toMatchObject({
          message: 'ViewerRunQuotaExceeded',
        });
      });
      expect(context!.getPendingRun(model)).toBeNull();

      await act(async () => {
        await expect(context!.startForegroundRun({ model })).rejects.toMatchObject({
          message: 'ViewerRunAlreadyActive',
        });
      });
      expect(context!.getPendingRun(model)).toMatchObject({ runId: null });

      await act(async () => {
        await expect(context!.startForegroundRun({ model })).resolves.toEqual({
          status: 'fallback',
        });
      });
    });
  });
});
