import React from 'react';
import { act, render as rtlRender, type RenderResult } from '@testing-library/react';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';
import { pacsAiStudyContextService } from '@pacs-ai/extension-core/src/services/PacsAiStudyContextService';
import {
  useViewerModelResults,
  ViewerModelResultsProvider,
  type ForegroundRunOutcome,
  type ViewerModelResultsContextValue,
} from './ViewerModelResultsProvider';
import { ViewerResultsRequestError, type ViewerResultsRepository } from './viewerResultsRepository';
import type { ViewerModelResult, ViewerModelRunStatus } from './types';

// A rerun requested from the viewer whose result is not the model's best run.
// Live case (2026-11-26): an automatic run used 4 videos, the user reran the
// model on 1 hand-picked series, the run completed in 41 s, and the viewer
// kept waiting because latest-results went on reporting the automatic run.

jest.mock('@pacs-ai/extension-core/src/inferenceProcessing/InferenceProcessingProvider', () => ({
  useOptionalInferenceProcessing: () => ({
    canViewStudyProcessingRunHistory: true,
    canUseStudyProcessingREST: true,
  }),
}));

const mockDrawerRenders: Array<{ result: ViewerModelResult; runs: ViewerModelResult[] }> = [];
let mockSelectRun: ((run: ViewerModelResult) => void) | undefined;

jest.mock('./ViewerModelResultDrawer', () => ({
  __esModule: true,
  default: (props: {
    result: ViewerModelResult;
    runs: ViewerModelResult[];
    onSelectRun?: (run: ViewerModelResult) => void;
  }) => {
    mockDrawerRenders.push({ result: props.result, runs: props.runs });
    mockSelectRun = props.onSelectRun;
    return <div data-testid="drawer">{props.result.executionId}</div>;
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      [key, options.modelName, options.reason].filter(Boolean).join(':'),
  }),
}));

const model = {
  modelId: 'DeepCORO_JEPA',
  containerId: 'container-1',
  modelName: 'DeepCORO-JEPA',
  version: '2.2.1',
};

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '2.2.1',
    modality: 'angiogram',
    modelId: 'registration-1',
    artifactModelId: 'DeepCORO_JEPA',
    containerId: 'container-1',
    runId: 'run-auto',
    executionId: 'execution-auto',
    studyServiceJobId: 'job-auto',
    completedAt: '2026-11-26T08:41:20-05:00',
    trigger: 'AUTO',
    selectedViews: null,
    reportAvailable: true,
    dispatchSeriesInstanceUIDs: null,
    eligibleVideoCount: 4,
    inputVideoCount: 5,
    ...overrides,
  };
}

const autoRun = result({ bestRun: true });
const viewerRerun = result({
  runId: 'run-viewer',
  executionId: 'execution-viewer',
  studyServiceJobId: 'job-viewer',
  completedAt: '2026-11-26T09:16:15-05:00',
  trigger: 'VIEWER_REQUEST',
  dispatchSeriesInstanceUIDs: ['series-1'],
  eligibleVideoCount: 1,
  inputVideoCount: 1,
  bestRun: false,
});
// What latest-results reports before and after the rerun: the best run is the
// automatic one both times.
const beforeRerun = result({ runs: [autoRun] });
const afterRerun = result({ runs: [viewerRerun, autoRun] });

const startedRun = {
  runId: 'run-viewer',
  runNumber: 2,
  trigger: 'VIEWER_REQUEST',
  executionId: 'execution-viewer',
  modelName: 'DeepCORO-JEPA',
  modelVersion: '2.2.1',
};
const running: ViewerModelRunStatus = {
  phase: 'PROCESSING',
  outcome: null,
  executions: [{ executionId: 'execution-viewer', status: 'running' }],
};
const succeeded: ViewerModelRunStatus = {
  phase: 'TERMINAL',
  outcome: 'SUCCESS',
  executions: [
    {
      executionId: 'execution-viewer',
      status: 'completed',
      completedAt: '2026-11-26T09:16:15-05:00',
    },
  ],
};

function repository(overrides: Partial<ViewerResultsRepository> = {}) {
  return {
    loadLatestResults: jest.fn().mockResolvedValue([beforeRerun]),
    loadReport: jest.fn(),
    runModel: jest.fn().mockResolvedValue(startedRun),
    loadRunStatus: jest.fn().mockResolvedValue(running),
    ...overrides,
  } as jest.Mocked<ViewerResultsRepository>;
}

const servicesManager = {
  services: {
    displaySetService: { getActiveDisplaySets: () => [] },
    viewportGridService: { getState: () => ({}) },
    customizationService: { getCustomization: () => null },
  },
} as unknown as AppTypes.ServicesManager;

describe('a viewer rerun that is not the best run', () => {
  let renderer: RenderResult | null = null;
  let context: ViewerModelResultsContextValue | null = null;
  const showAlert = jest.fn();

  function Probe() {
    context = useViewerModelResults();
    return null;
  }

  const flush = () =>
    act(async () => {
      await Promise.resolve();
    });
  const tick = async (milliseconds = 1000) => {
    await act(async () => {
      jest.advanceTimersByTime(milliseconds);
    });
    await flush();
    await flush();
    await flush();
  };

  async function mount(repo: ViewerResultsRepository, maxPendingMs?: number) {
    jest.useFakeTimers();
    await act(async () => {
      renderer = rtlRender(
        <AlertContext.Provider value={showAlert}>
          <ViewerModelResultsProvider
            studyInstanceUID="1.2.3"
            servicesManager={servicesManager}
            repository={repo}
            pollIntervalMs={1000}
            {...(maxPendingMs ? { maxPendingMs } : {})}
          >
            <Probe />
          </ViewerModelResultsProvider>
        </AlertContext.Provider>
      );
    });
    await act(async () => {
      await context!.refreshLatestResults();
    });
  }

  async function startForeground() {
    let outcome: ForegroundRunOutcome | undefined;
    let error: unknown;
    await act(async () => {
      void context!
        .startForegroundRun({ model, seriesInstanceUIDs: ['series-1'], studyInstanceUID: '1.2.3' })
        .then(
          settled => {
            outcome = settled;
          },
          (rejected: unknown) => {
            error = rejected;
          }
        );
    });
    return { outcome: () => outcome, error: () => error };
  }

  const drawers = () =>
    Array.from(renderer!.container.querySelectorAll<HTMLElement>('[data-testid="drawer"]'));
  const readyNotices = () =>
    Array.from(
      renderer!.container.querySelectorAll<HTMLElement>(
        '[data-testid="viewer-model-result-ready-view"]'
      )
    );

  beforeEach(() => {
    showAlert.mockReset();
    mockDrawerRenders.length = 0;
    mockSelectRun = undefined;
    pacsAiStudyContextService.reset();
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    context = null;
    jest.useRealTimers();
  });

  test('opens the rerun when it completes although the automatic run stays the reported result', async () => {
    const repo = repository();
    await mount(repo);
    const run = await startForeground();

    await tick();
    expect(run.outcome()).toBeUndefined();
    expect(context!.getPendingRun(model)?.executionId).toBe('execution-viewer');

    repo.loadRunStatus.mockResolvedValue(succeeded);
    repo.loadLatestResults.mockResolvedValue([afterRerun]);
    await tick();

    expect(run.outcome()).toMatchObject({
      status: 'completed',
      result: { runId: 'run-viewer', executionId: 'execution-viewer' },
    });
    expect(context!.getPendingRun(model)).toBeNull();
    expect(drawers().map(drawer => drawer.textContent)).toEqual(['execution-viewer']);
    expect(context!.openedResult?.result).toMatchObject({
      executionId: 'execution-viewer',
      studyServiceJobId: 'job-viewer',
      trigger: 'VIEWER_REQUEST',
      eligibleVideoCount: 1,
    });
    // The default selection is unchanged: the best run.
    expect(context!.getLatestResult(model)?.executionId).toBe('execution-auto');
    expect(context!.getResultRuns(model).map(item => item.executionId)).toEqual([
      'execution-viewer',
      'execution-auto',
    ]);
    // The drawer is given both runs to switch between.
    const lastRender = mockDrawerRenders[mockDrawerRenders.length - 1];
    expect(lastRender.runs.map(item => [item.executionId, item.bestRun])).toEqual([
      ['execution-viewer', false],
      ['execution-auto', true],
    ]);
    expect(showAlert).not.toHaveBeenCalled();

    // No more polling once the run has ended.
    repo.loadRunStatus.mockClear();
    repo.loadLatestResults.mockClear();
    await tick(5000);
    expect(repo.loadRunStatus).not.toHaveBeenCalled();
    expect(repo.loadLatestResults).not.toHaveBeenCalled();
  });

  test('switches the drawer to another run of the model and back', async () => {
    const repo = repository({ loadLatestResults: jest.fn().mockResolvedValue([afterRerun]) });
    await mount(repo);

    act(() => context!.openResult(context!.getLatestResult(model) as ViewerModelResult));
    expect(drawers().map(drawer => drawer.textContent)).toEqual(['execution-auto']);

    act(() => mockSelectRun?.(viewerRerun));
    expect(drawers().map(drawer => drawer.textContent)).toEqual(['execution-viewer']);
    expect(context!.openedResult?.result.executionId).toBe('execution-viewer');

    act(() => mockSelectRun?.(autoRun));
    expect(drawers().map(drawer => drawer.textContent)).toEqual(['execution-auto']);
  });

  test('opens the run from its ids when the backend lists no runs, then adopts the listed result', async () => {
    // An api-pacs or study-service that predates the run list: latest-results
    // only ever returns the automatic run.
    const legacyReported = result();
    const repo = repository({ loadLatestResults: jest.fn().mockResolvedValue([legacyReported]) });
    await mount(repo);
    const run = await startForeground();

    repo.loadRunStatus.mockResolvedValue(succeeded);
    await tick();

    expect(run.outcome()).toMatchObject({ status: 'completed' });
    expect(context!.openedResult?.result).toMatchObject({
      runId: 'run-viewer',
      executionId: 'execution-viewer',
      studyServiceJobId: null,
      completedAt: '2026-11-26T09:16:15-05:00',
      trigger: 'VIEWER_REQUEST',
      dispatchSeriesInstanceUIDs: ['series-1'],
      reportAvailable: true,
      provisional: true,
    });
    expect(context!.getPendingRun(model)).toBeNull();
    // Both runs are offered: the one just opened and the reported one.
    const provisionalRender = mockDrawerRenders[mockDrawerRenders.length - 1];
    expect(provisionalRender.runs.map(item => item.executionId)).toEqual([
      'execution-viewer',
      'execution-auto',
    ]);

    // Looking at the reported run does not lose the run just completed: it
    // stays offered in the drawer and in the menu.
    act(() => mockSelectRun?.(legacyReported));
    expect(context!.openedResult?.result.executionId).toBe('execution-auto');
    expect(
      mockDrawerRenders[mockDrawerRenders.length - 1].runs.map(item => item.executionId)
    ).toEqual(['execution-viewer', 'execution-auto']);
    expect(context!.getResultRuns(model).map(item => item.executionId)).toEqual([
      'execution-viewer',
      'execution-auto',
    ]);
    act(() => mockSelectRun?.(context!.getResultRuns(model)[0]));
    expect(context!.openedResult?.result).toMatchObject({
      executionId: 'execution-viewer',
      provisional: true,
    });

    // Once the backend lists the run, the opened result becomes the stored one.
    repo.loadLatestResults.mockResolvedValue([afterRerun]);
    await act(async () => {
      await context!.refreshLatestResults();
    });
    expect(context!.openedResult?.result).toMatchObject({
      executionId: 'execution-viewer',
      studyServiceJobId: 'job-viewer',
    });
    expect(context!.openedResult?.result.provisional).toBeUndefined();
    expect(context!.getResultRuns(model).map(item => item.studyServiceJobId)).toEqual([
      'job-viewer',
      'job-auto',
    ]);
  });

  test('reads the results again when the run completed after they were loaded', async () => {
    const repo = repository({ loadRunStatus: jest.fn().mockResolvedValue(succeeded) });
    await mount(repo);
    const run = await startForeground();
    repo.loadLatestResults.mockClear();
    repo.loadLatestResults.mockResolvedValueOnce([beforeRerun]).mockResolvedValueOnce([afterRerun]);

    await tick();

    expect(repo.loadLatestResults).toHaveBeenCalledTimes(2);
    expect(run.outcome()).toMatchObject({
      status: 'completed',
      result: { studyServiceJobId: 'job-viewer' },
    });
    expect(context!.openedResult?.result.provisional).toBeUndefined();
  });

  test('offers a completed background rerun through the ready notice', async () => {
    const repo = repository();
    await mount(repo);
    await act(async () => {
      await context!.startManagedRun({ model, seriesInstanceUIDs: ['series-1'] });
    });

    repo.loadRunStatus.mockResolvedValue(succeeded);
    repo.loadLatestResults.mockResolvedValue([afterRerun]);
    await tick();

    expect(context!.getPendingRun(model)).toBeNull();
    expect(context!.openedResult).toBeNull();
    expect(readyNotices()).toHaveLength(1);
  });

  test.each([
    [
      'skipped',
      {
        executionId: 'execution-viewer',
        status: 'skipped',
        skipReasonCode: 'NO_USABLE_DICOM',
        skipReasonMessage: 'No diagnostic left/right coronary contrast videos were identified',
      },
      'ViewerRunEndedSkippedReason:DeepCORO-JEPA:No diagnostic left/right coronary contrast videos were identified',
      'error',
      'No diagnostic left/right coronary contrast videos were identified',
    ],
    [
      'failed',
      {
        executionId: 'execution-viewer',
        status: 'failed',
        errorMessage: 'model container crashed',
      },
      'ViewerRunEndedFailedReason:DeepCORO-JEPA:model container crashed',
      'error',
      'model container crashed',
    ],
    [
      'cancelled',
      { executionId: 'execution-viewer', status: 'cancelled' },
      'ViewerRunEndedCancelled:DeepCORO-JEPA',
      'info',
      null,
    ],
  ])(
    'says why a %s rerun produced no result',
    async (failure, execution, message, variant, reason) => {
      const repo = repository({
        loadRunStatus: jest.fn().mockResolvedValue({
          phase: 'TERMINAL',
          outcome: failure === 'cancelled' ? 'CANCELLED' : 'NO_RESULT',
          executions: [execution],
        }),
      });
      await mount(repo);
      const run = await startForeground();

      await tick();

      expect(run.outcome()).toEqual({ status: 'failed', failure, reason });
      expect(showAlert).toHaveBeenCalledWith(message, variant);
      expect(context!.getPendingRun(model)).toBeNull();
      expect(context!.openedResult).toBeNull();
    }
  );

  test('stops waiting on a run the backend no longer knows', async () => {
    const repo = repository({
      loadRunStatus: jest
        .fn()
        .mockRejectedValue(new ViewerResultsRequestError('x', 404, 'MISSING_RECORD')),
    });
    await mount(repo);
    const run = await startForeground();

    await tick();

    expect(run.outcome()).toEqual({ status: 'failed', failure: 'failed', reason: null });
    expect(context!.getPendingRun(model)).toBeNull();
  });

  test('times out instead of waiting forever when the run never reports an end', async () => {
    const repo = repository();
    await mount(repo, 2500);
    const run = await startForeground();

    await tick();
    await tick();
    expect(run.outcome()).toBeUndefined();
    await tick();

    expect(run.outcome()).toEqual({ status: 'timedOut' });
    expect(showAlert).toHaveBeenCalledWith('ViewerRunStillRunning:DeepCORO-JEPA', 'info');
    expect(context!.getPendingRun(model)).toBeNull();
    repo.loadRunStatus.mockClear();
    await tick(5000);
    expect(repo.loadRunStatus).not.toHaveBeenCalled();
  });

  test('a second click on Run keeps following the run that was started', async () => {
    const repo = repository();
    await mount(repo);
    const first = await startForeground();
    repo.runModel.mockRejectedValue(new ViewerResultsRequestError('x', 409, 'RUN_ALREADY_ACTIVE'));

    const second = await startForeground();
    await flush();

    expect(second.error()).toMatchObject({ message: 'ViewerRunAlreadyActive' });
    // The tracked run still carries the ids returned by the first request.
    expect(context!.getPendingRun(model)).toMatchObject({
      runId: 'run-viewer',
      executionId: 'execution-viewer',
    });

    repo.loadRunStatus.mockResolvedValue(succeeded);
    repo.loadLatestResults.mockResolvedValue([afterRerun]);
    await tick();

    expect(first.outcome()).toMatchObject({ status: 'completed' });
    expect(context!.openedResult?.result.executionId).toBe('execution-viewer');
  });

  test('follows a run that was already active to its result, although it is not the best run', async () => {
    const repo = repository({
      runModel: jest
        .fn()
        .mockRejectedValue(new ViewerResultsRequestError('x', 409, 'RUN_ALREADY_ACTIVE')),
    });
    await mount(repo);
    await act(async () => {
      await expect(context!.startManagedRun({ model })).rejects.toMatchObject({
        message: 'ViewerRunAlreadyActive',
      });
    });
    expect(context!.getPendingRun(model)).toMatchObject({
      runId: null,
      baselineCompletedAt: autoRun.completedAt,
    });

    await tick();
    expect(context!.getPendingRun(model)).not.toBeNull();

    repo.loadLatestResults.mockResolvedValue([afterRerun]);
    await tick();

    expect(context!.getPendingRun(model)).toBeNull();
    expect(readyNotices()).toHaveLength(1);
    expect(repo.loadRunStatus).not.toHaveBeenCalled();
  });
});
