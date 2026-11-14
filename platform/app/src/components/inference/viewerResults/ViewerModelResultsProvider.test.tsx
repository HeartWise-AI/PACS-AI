import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AlertContext } from '../../../AlertProvider';
import {
  useViewerModelResults,
  ViewerModelResultsProvider,
  type ViewerModelResultsContextValue,
} from './ViewerModelResultsProvider';
import { ViewerResultsRequestError, type ViewerResultsRepository } from './viewerResultsRepository';
import type { ViewerModelResult } from './types';

const mockInferenceProcessing = {
  canViewStudyProcessingRunHistory: true,
  canUseStudyProcessingREST: true,
};

jest.mock('../InferenceProcessingProvider', () => ({
  useOptionalInferenceProcessing: () => mockInferenceProcessing,
}));

jest.mock('./ViewerModelResultDrawer', () => ({
  __esModule: true,
  default: ({ result }: { result: ViewerModelResult }) => (
    <div data-testid="drawer">{result.modelName}</div>
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
    servicesManager = services().servicesManager
  ) {
    await act(async () => {
      renderer = TestRenderer.create(
        <AlertContext.Provider value={showAlert}>
          <ViewerModelResultsProvider
            studyInstanceUID="1.2.3"
            servicesManager={servicesManager}
            repository={repo}
            pollIntervalMs={1000}
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
});
