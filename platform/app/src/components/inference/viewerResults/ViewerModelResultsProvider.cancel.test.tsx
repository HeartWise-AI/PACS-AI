import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AlertContext } from '../../../AlertProvider';
import {
  useViewerModelResults,
  ViewerModelResultsProvider,
  type ViewerModelResultsContextValue,
} from './ViewerModelResultsProvider';
import type { ViewerResultsRepository } from './viewerResultsRepository';

const mockCancelProcessingRun = jest.fn();

jest.mock('../InferenceProcessingProvider', () => ({
  useOptionalInferenceProcessing: () => ({
    canViewStudyProcessingRunHistory: true,
    canUseStudyProcessingREST: true,
  }),
}));

// The card cancels through the processing REST repository.
jest.mock('../studyProcessing/restRepository', () => ({
  ...jest.requireActual('../studyProcessing/restRepository'),
  createStudyProcessingRESTRepository: () => ({
    cancelProcessingRun: (runId: string) => mockCancelProcessingRun(runId),
  }),
}));

jest.mock('./ViewerModelResultDrawer', () => ({ __esModule: true, default: () => null }));

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

const queuedStatus = {
  phase: 'QUEUED',
  outcome: null,
  executions: [{ executionId: 'execution-2', status: 'queued' }],
  cancellable: true,
};

const cancelledStatus = {
  phase: 'TERMINAL',
  outcome: 'CANCELLED',
  executions: [{ executionId: 'execution-2', status: 'cancelled' }],
  cancellable: false,
};

describe('ViewerModelResultsProvider: run cancelled from the running-jobs card', () => {
  let renderer: ReactTestRenderer | null = null;
  let context: ViewerModelResultsContextValue | null = null;
  const showAlert = jest.fn();

  function Probe() {
    context = useViewerModelResults();
    return null;
  }

  function repository() {
    return {
      loadLatestResults: jest.fn().mockResolvedValue([]),
      loadReport: jest.fn(),
      runModel: jest.fn().mockResolvedValue({
        runId: 'run-2',
        runNumber: 2,
        trigger: 'VIEWER_REQUEST',
        executionId: 'execution-2',
        modelName: 'DeepCORO-JEPA',
        modelVersion: '1.3.0',
      }),
      loadRunStatus: jest.fn().mockResolvedValue(queuedStatus),
    } as unknown as jest.Mocked<ViewerResultsRepository>;
  }

  const flush = () =>
    act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

  const tick = async (milliseconds: number) => {
    await act(async () => {
      jest.advanceTimersByTime(milliseconds);
    });
    await flush();
    await flush();
  };

  const byTestId = (id: string) => renderer!.root.findAllByProps({ 'data-testid': id });
  const jobStates = () => byTestId('running-jobs-row').map(row => row.props['data-state']);
  const click = (id: string) => act(async () => byTestId(id)[0].props.onClick());

  async function startQueuedRun(repo: jest.Mocked<ViewerResultsRepository>) {
    jest.useFakeTimers();
    await act(async () => {
      renderer = TestRenderer.create(
        <AlertContext.Provider value={showAlert}>
          <ViewerModelResultsProvider
            studyInstanceUID="1.2.3"
            servicesManager={{ services: {} } as unknown as AppTypes.ServicesManager}
            repository={repo}
            pollIntervalMs={1000}
          >
            <Probe />
          </ViewerModelResultsProvider>
        </AlertContext.Provider>
      );
    });
    await act(async () => {
      await context!.startManagedRun({ model });
    });
    // The first poll reports the run queued and cancellable.
    await tick(1000);
  }

  beforeEach(() => {
    showAlert.mockReset();
    mockCancelProcessingRun.mockReset();
    mockCancelProcessingRun.mockResolvedValue({
      id: 'run-2',
      phase: 'TERMINAL',
      outcome: 'CANCELLED',
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    context = null;
    jest.useRealTimers();
  });

  test('ends the run as cancelled, without the "run failed" alert', async () => {
    const repo = repository();
    await startQueuedRun(repo);
    expect(jobStates()).toEqual(['queued']);
    expect(byTestId('running-jobs-cancel')).toHaveLength(1);
    showAlert.mockClear();

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');
    await flush();

    expect(mockCancelProcessingRun).toHaveBeenCalledWith('run-2');
    expect(jobStates()).toEqual(['cancelled']);
    expect(context!.getPendingRun(model)).toBeNull();

    // Later polls no longer track the run, and nothing is reported as failed.
    repo.loadRunStatus.mockResolvedValue(cancelledStatus);
    const statusCalls = repo.loadRunStatus.mock.calls.length;
    await tick(3000);
    expect(repo.loadRunStatus.mock.calls.length).toBe(statusCalls);
    expect(showAlert).not.toHaveBeenCalled();
    expect(jobStates()).toEqual(['cancelled']);

    await tick(6000);
    expect(byTestId('running-jobs-row')).toHaveLength(0);
  });

  test('a poll already in flight does not report the cancelled run as failed', async () => {
    const repo = repository();
    await startQueuedRun(repo);
    showAlert.mockClear();

    // The poll reads the run as cancelled only after the card got its answer.
    let answerPoll!: (status: typeof cancelledStatus) => void;
    repo.loadRunStatus.mockReturnValue(
      new Promise(resolve => {
        answerPoll = resolve;
      }) as never
    );
    await tick(1000);

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');
    await flush();
    expect(jobStates()).toEqual(['cancelled']);

    await act(async () => {
      answerPoll(cancelledStatus);
    });
    await flush();

    expect(showAlert).not.toHaveBeenCalled();
    expect(jobStates()).toEqual(['cancelled']);
  });

  test('keeps tracking the run when the cancellation fails', async () => {
    const repo = repository();
    mockCancelProcessingRun.mockRejectedValue(Object.assign(new Error('x'), { status: 503 }));
    await startQueuedRun(repo);

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');
    await flush();

    expect(byTestId('running-jobs-cancel-error')).toHaveLength(1);
    expect(jobStates()).toEqual(['queued']);
    expect(context!.getPendingRun(model)).not.toBeNull();
  });
});
