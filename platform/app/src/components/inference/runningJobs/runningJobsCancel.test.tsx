import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import english from '../../../../../i18n/src/locales/en-US/AIModelButton.json';
import french from '../../../../../i18n/src/locales/fr/AIModelButton.json';
import { StudyProcessingRESTError } from '../studyProcessing/restRepository';
import type { StudyProcessingSummary } from '../studyProcessing/types';
import { jobRow, pendingRun, processingRun, STUDY_UID } from './testSupport';
import type { RunningJobRow } from './types';
import {
  applyRunningJobCancelStates,
  useRunningJobsCancel,
  type RunningJobsCancel,
} from './useRunningJobsCancel';
import {
  ViewerRunningJobsIndicator,
  type ViewerRunningJobsIndicatorProps,
} from './ViewerRunningJobsIndicator';

const mockInferenceProcessing = {
  canViewStudyProcessing: true,
  canUseStudyProcessingREST: true,
};
let mockStrings: Record<string, string> = english;

jest.mock('../InferenceProcessingProvider', () => ({
  useOptionalInferenceProcessing: () => mockInferenceProcessing,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      jest.requireActual('./testSupport').translate(mockStrings, key, options),
  }),
}));

const START = Date.parse('2026-11-10T10:25:27Z');

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useRunningJobsCancel', () => {
  let renderer: ReactTestRenderer | null = null;
  let hook: RunningJobsCancel | null = null;
  const row = jobRow({ id: 'processing:run-1', cancelRunId: 'run-1' });

  function Probe({
    cancel,
  }: {
    cancel: (row: RunningJobRow) => Promise<'ended' | 'stillRunning'>;
  }) {
    hook = useRunningJobsCancel({ cancel });
    return null;
  }

  function render(cancel: (row: RunningJobRow) => Promise<'ended' | 'stillRunning'>) {
    act(() => {
      renderer = TestRenderer.create(<Probe cancel={cancel} />);
    });
  }

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    hook = null;
  });

  test('asks for confirmation first, and aborting calls nothing', () => {
    const cancel = jest.fn();
    render(cancel);
    expect(hook!.states).toEqual({});

    // Confirming without the confirmation step does nothing.
    act(() => hook!.confirm(row));
    expect(cancel).not.toHaveBeenCalled();

    act(() => hook!.request(row));
    expect(hook!.states).toEqual({ 'processing:run-1': { phase: 'confirming' } });
    act(() => hook!.abort(row));
    expect(hook!.states).toEqual({});
    expect(cancel).not.toHaveBeenCalled();
  });

  test('submits once, then reports the run as cancelled', async () => {
    const pending = deferred<'ended' | 'stillRunning'>();
    const cancel = jest.fn().mockReturnValue(pending.promise);
    render(cancel);

    act(() => hook!.request(row));
    act(() => hook!.confirm(row));
    expect(hook!.states[row.id]).toEqual({ phase: 'submitting' });
    // A second click, or an abort, while the request is in flight is ignored.
    act(() => hook!.confirm(row));
    act(() => hook!.abort(row));
    act(() => hook!.request(row));
    expect(hook!.states[row.id]).toEqual({ phase: 'submitting' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(row);

    await act(async () => {
      pending.resolve('ended');
    });
    expect(hook!.states[row.id]).toMatchObject({ phase: 'cancelled' });
    expect(typeof hook!.states[row.id].at).toBe('number');
    // Nothing more can be asked of a cancelled row.
    act(() => hook!.request(row));
    expect(hook!.states[row.id].phase).toBe('cancelled');
  });

  test('goes back to the plain row when a model is still computing', async () => {
    render(jest.fn().mockResolvedValue('stillRunning'));
    act(() => hook!.request(row));
    await act(async () => {
      hook!.confirm(row);
    });
    expect(hook!.states).toEqual({});
  });

  test('keeps the row with an error, and can be retried', async () => {
    const cancel = jest
      .fn()
      .mockRejectedValueOnce(new StudyProcessingRESTError('x', 503))
      .mockRejectedValueOnce(new StudyProcessingRESTError('x', 409))
      .mockResolvedValueOnce('ended');
    render(cancel);

    act(() => hook!.request(row));
    await act(async () => {
      hook!.confirm(row);
    });
    expect(hook!.states[row.id]).toEqual({ phase: 'error', error: 'failed' });

    act(() => hook!.request(row));
    expect(hook!.states[row.id]).toEqual({ phase: 'confirming' });
    await act(async () => {
      hook!.confirm(row);
    });
    expect(hook!.states[row.id]).toEqual({ phase: 'error', error: 'tooLate' });

    act(() => hook!.request(row));
    await act(async () => {
      hook!.confirm(row);
    });
    expect(hook!.states[row.id].phase).toBe('cancelled');
    expect(cancel).toHaveBeenCalledTimes(3);
  });

  test('does not update after the card is gone', async () => {
    const pending = deferred<'ended' | 'stillRunning'>();
    render(jest.fn().mockReturnValue(pending.promise));
    act(() => hook!.request(row));
    act(() => hook!.confirm(row));
    act(() => renderer!.unmount());
    renderer = null;
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      pending.resolve('ended');
    });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test('a confirmed cancellation shows at once, before the next poll', () => {
    const waiting = jobRow({
      id: 'a',
      state: 'queued',
      waiting: 'exam',
      cancelRunId: 'run-1',
      runningModelNames: ['Model A'],
    });
    const other = jobRow({ id: 'b' });

    const rows = applyRunningJobCancelStates([waiting, other], {
      a: { phase: 'cancelled', at: 1_234_000 },
      b: { phase: 'submitting' },
    });

    expect(rows[0]).toMatchObject({
      id: 'a',
      state: 'cancelled',
      active: false,
      endedAt: 1_234_000,
      runningModelNames: [],
    });
    expect(rows[0]).not.toHaveProperty('waiting');
    expect(rows[0]).not.toHaveProperty('cancelRunId');
    expect(rows[1]).toBe(other);
  });
});

describe('cancelling from the running-jobs card', () => {
  let renderer: ReactTestRenderer | null = null;
  let props: ViewerRunningJobsIndicatorProps;

  // Three of six models done; the others wait for the exam to finish.
  const waitingRun = (overrides: Parameters<typeof processingRun>[0] = {}) =>
    processingRun({
      phase: 'QUEUED',
      expectedModels: 6,
      pendingModels: 3,
      queuedModels: 0,
      runningModels: 0,
      completedModels: 3,
      skippedModels: 0,
      activeModels: 3,
      waitingReason: 'study_growing',
      cancellable: true,
      ...overrides,
    });
  const cancelledRun = () =>
    waitingRun({
      phase: 'TERMINAL',
      outcome: 'PARTIAL_SUCCESS',
      pendingModels: 0,
      cancelledModels: 3,
      activeModels: 0,
      cancellable: false,
      cancelledAt: '2026-11-10T10:25:30Z',
      waitingReason: undefined,
    });

  function summaryOf(run: ReturnType<typeof processingRun>): StudyProcessingSummary {
    const {
      id,
      modelExecutions,
      createdAt,
      cancellable,
      cancelledAt,
      waitingReason,
      stableAfter,
      ...rest
    } = run;
    void [modelExecutions, createdAt, cancellable, cancelledAt, waitingReason, stableAfter];
    return {
      ...rest,
      runId: id,
      ingestionStatus: 'GROWING',
      retrievalState: null,
      retrievalError: null,
      lifecycle: 'QUEUED',
    };
  }

  function repository(run = waitingRun()) {
    return {
      loadWorklistStudyStatuses: jest
        .fn()
        .mockResolvedValue({ summaries: [summaryOf(run)], limit: 25, offset: 0, hasMore: false }),
      loadProcessingRunDetail: jest.fn().mockResolvedValue(run),
      cancelProcessingRun: jest.fn().mockResolvedValue(cancelledRun()),
    };
  }

  async function render(overrides: Partial<ViewerRunningJobsIndicatorProps> = {}) {
    props = { ...props, ...overrides };
    await act(async () => {
      if (renderer) {
        renderer.update(<ViewerRunningJobsIndicator {...props} />);
      } else {
        renderer = TestRenderer.create(<ViewerRunningJobsIndicator {...props} />);
      }
    });
    await settle();
  }

  const byTestId = (id: string) => renderer!.root.findAllByProps({ 'data-testid': id });
  const rendered = () => JSON.stringify(renderer!.toJSON());
  const click = (id: string) => act(async () => byTestId(id)[0].props.onClick());

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
    window.localStorage.clear();
    mockStrings = english;
    mockInferenceProcessing.canViewStudyProcessing = true;
    mockInferenceProcessing.canUseStudyProcessingREST = true;
    props = { studyInstanceUID: STUDY_UID, pendingRuns: [], processingPollIntervalMs: 5000 };
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  test('cancels the automatic analysis after an inline confirmation', async () => {
    const repo = repository();
    const confirmSpy = jest.spyOn(window, 'confirm');
    await render({ processingRepository: repo });

    expect(rendered()).toContain('Waiting for the exam to finish');
    expect(rendered()).toContain('3 of 6 models');
    const [button] = byTestId('running-jobs-cancel');
    expect(button.props.title).toBe('Cancel analysis');
    expect(button.props['aria-label']).toBe('Cancel analysis: Automatic analysis');
    expect(byTestId('running-jobs-cancel-confirm')).toHaveLength(0);

    // Step 1: the confirmation opens inside the card; nothing is sent yet.
    await click('running-jobs-cancel');
    const [confirm] = byTestId('running-jobs-cancel-confirm');
    expect(confirm.props.role).toBe('group');
    expect(rendered()).toContain('Cancel this analysis?');
    expect(rendered()).toContain('Models already finished keep their results.');
    expect(byTestId('running-jobs-cancel')).toHaveLength(0);
    expect(repo.cancelProcessingRun).not.toHaveBeenCalled();

    // Step 2: confirmed.
    await click('running-jobs-cancel-yes');
    await settle();
    expect(repo.cancelProcessingRun).toHaveBeenCalledTimes(1);
    expect(repo.cancelProcessingRun).toHaveBeenCalledWith('auto-run-1');
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();

    // A brief "Cancelled" end state: no button, no bar, nothing counted.
    const [row] = byTestId('running-jobs-row');
    expect(row.props['data-state']).toBe('cancelled');
    expect(rendered()).toContain('Cancelled');
    expect(rendered()).not.toContain('Waiting for the exam to finish');
    expect(byTestId('running-jobs-cancel')).toHaveLength(0);
    expect(byTestId('running-jobs-cancel-confirm')).toHaveLength(0);
    expect(byTestId('running-jobs-progress')).toHaveLength(0);
    expect(rendered()).toContain('Finished');

    // The run is looked at again, then its row leaves like any ended row.
    repo.loadProcessingRunDetail.mockResolvedValue(cancelledRun());
    await advance(5000);
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('cancelled');
    await advance(6000);
    expect(renderer!.toJSON()).toBeNull();
    // Neither the study nor a patient identifier was rendered or sent.
    expect(repo.cancelProcessingRun.mock.calls.flat().join()).not.toContain(STUDY_UID);
  });

  test('aborting the confirmation keeps the run and calls nothing', async () => {
    const repo = repository();
    await render({ processingRepository: repo });

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-no');

    expect(repo.cancelProcessingRun).not.toHaveBeenCalled();
    expect(byTestId('running-jobs-cancel-confirm')).toHaveLength(0);
    expect(byTestId('running-jobs-cancel')).toHaveLength(1);
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('queued');
    expect(rendered()).toContain('Waiting for the exam to finish');
  });

  test('disables the confirmation while the request is in flight', async () => {
    const repo = repository();
    const pending = deferred<ReturnType<typeof processingRun>>();
    repo.cancelProcessingRun.mockReturnValue(pending.promise);
    await render({ processingRepository: repo });

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');

    expect(rendered()).toContain('Cancelling…');
    expect(byTestId('running-jobs-cancel-yes')[0].props.disabled).toBe(true);
    expect(byTestId('running-jobs-cancel-no')[0].props.disabled).toBe(true);
    await click('running-jobs-cancel-yes');
    expect(repo.cancelProcessingRun).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(cancelledRun());
    });
    await settle();
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('cancelled');
  });

  test('keeps the row and shows an inline message when the cancellation fails', async () => {
    const repo = repository();
    repo.cancelProcessingRun.mockRejectedValue(new StudyProcessingRESTError('x', 503));
    await render({ processingRepository: repo });

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');
    await settle();

    const [error] = byTestId('running-jobs-cancel-error');
    expect(error.props.role).toBe('alert');
    expect(rendered()).toContain('Could not cancel. Try again.');
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('queued');
    expect(rendered()).toContain('Waiting for the exam to finish');
    // The button is back for another try, which succeeds.
    repo.cancelProcessingRun.mockResolvedValue(cancelledRun());
    await click('running-jobs-cancel');
    expect(byTestId('running-jobs-cancel-error')).toHaveLength(0);
    await click('running-jobs-cancel-yes');
    await settle();
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('cancelled');
  });

  test('a backend without the endpoint leaves an error, not a broken card', async () => {
    const repo = repository();
    repo.cancelProcessingRun.mockRejectedValue(new StudyProcessingRESTError('x', 404));
    await render({ processingRepository: repo });

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');
    await settle();

    expect(byTestId('running-jobs-cancel-error')).toHaveLength(1);
    expect(byTestId('running-jobs-row')).toHaveLength(1);
  });

  test('says so when the run started computing meanwhile, and drops the button', async () => {
    const repo = repository();
    repo.cancelProcessingRun.mockRejectedValue(new StudyProcessingRESTError('x', 409));
    await render({ processingRepository: repo });
    const detailCalls = repo.loadProcessingRunDetail.mock.calls.length;
    // What the run now is: computing its last model, nothing left to cancel.
    repo.loadProcessingRunDetail.mockResolvedValue(
      waitingRun({
        phase: 'PROCESSING',
        pendingModels: 0,
        runningModels: 1,
        completedModels: 5,
        activeModels: 1,
        cancellable: false,
        waitingReason: undefined,
      })
    );

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');
    await settle();

    expect(rendered()).toContain('Already computing: it can no longer be cancelled.');
    // The attempt triggered another look at the run without waiting for the poll.
    expect(repo.loadProcessingRunDetail.mock.calls.length).toBeGreaterThan(detailCalls);
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('running');
    expect(byTestId('running-jobs-cancel')).toHaveLength(0);
  });

  test('keeps following a run whose last model is still computing', async () => {
    const repo = repository(
      waitingRun({ phase: 'PROCESSING', runningModels: 1, waitingReason: undefined })
    );
    const stillRunning = waitingRun({
      phase: 'PROCESSING',
      pendingModels: 0,
      runningModels: 1,
      cancelledModels: 3,
      activeModels: 1,
      cancellable: false,
      cancelledAt: '2026-11-10T10:25:30Z',
      waitingReason: undefined,
    });
    repo.cancelProcessingRun.mockResolvedValue(stillRunning);
    await render({ processingRepository: repo });
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('running');
    repo.loadProcessingRunDetail.mockResolvedValue(stillRunning);

    await click('running-jobs-cancel');
    await click('running-jobs-cancel-yes');
    await settle();

    // Not shown as cancelled: a model is still computing and will be recorded.
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('running');
    expect(byTestId('running-jobs-cancel')).toHaveLength(0);
    expect(byTestId('running-jobs-cancel-error')).toHaveLength(0);
    expect(byTestId('running-jobs-spinner').length).toBeGreaterThan(0);
  });

  test('offers nothing against a backend that does not report cancellable', async () => {
    const legacy = waitingRun({ cancellable: undefined, waitingReason: undefined });
    const repo = repository(legacy);
    await render({ processingRepository: repo });

    expect(byTestId('running-jobs-row')).toHaveLength(1);
    expect(byTestId('running-jobs-cancel')).toHaveLength(0);
    // Old wording, old ticking timer.
    expect(rendered()).toContain('Queued');
    expect(rendered()).not.toContain('Waiting for the exam to finish');
    expect(byTestId('running-jobs-elapsed')).toHaveLength(1);
    expect(repo.cancelProcessingRun).not.toHaveBeenCalled();
  });

  test('never offers cancel for a run that is computing and not cancellable', async () => {
    const repo = repository(
      waitingRun({
        phase: 'PROCESSING',
        pendingModels: 0,
        runningModels: 3,
        cancellable: false,
        waitingReason: undefined,
      })
    );
    await render({ processingRepository: repo });

    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('running');
    expect(byTestId('running-jobs-cancel')).toHaveLength(0);
  });

  test('cancels a queued run requested from the viewer and tells its owner', async () => {
    mockInferenceProcessing.canUseStudyProcessingREST = false;
    const run = pendingRun({ requestedAt: START - 20_000 });
    const onRunCancelled = jest.fn();
    const cancelProcessingRun = jest.fn().mockResolvedValue(
      processingRun({
        id: 'run-1',
        trigger: 'VIEWER_REQUEST',
        phase: 'TERMINAL',
        outcome: 'CANCELLED',
        expectedModels: 1,
        cancelledModels: 1,
        cancelledAt: '2026-11-10T10:25:30Z',
      })
    );
    const repo = { ...repository(), cancelProcessingRun };
    await render({
      processingRepository: repo,
      pendingRuns: [run],
      pendingRunStatuses: new Map([
        [run, { phase: 'QUEUED', outcome: null, executions: [], cancellable: true }],
      ]),
      onRunCancelled,
    });
    expect(byTestId('running-jobs-cancel')[0].props['aria-label']).toBe(
      'Cancel analysis: DeepCORO'
    );

    await click('running-jobs-cancel');
    // A single model has no earlier results to keep.
    expect(rendered()).not.toContain('Models already finished keep their results.');
    await click('running-jobs-cancel-yes');
    await settle();

    expect(cancelProcessingRun).toHaveBeenCalledWith('run-1');
    expect(onRunCancelled).toHaveBeenCalledTimes(1);
    expect(onRunCancelled).toHaveBeenCalledWith(run);
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('cancelled');

    // Its owner stops tracking it and reports it ended as cancelled.
    await render({
      pendingRuns: [],
      pendingRunStatuses: new Map(),
      endedRuns: [
        { run, outcome: 'cancelled', result: null, endedAt: Date.now(), foreground: false },
      ],
    });
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('cancelled');
    await advance(6000);
    expect(renderer!.toJSON()).toBeNull();
  });

  test('does not offer cancel for a viewer run the backend calls not cancellable', async () => {
    const run = pendingRun();
    await render({
      processingRepository: repository(),
      pendingRuns: [run],
      pendingRunStatuses: new Map([
        [
          run,
          {
            phase: 'PROCESSING',
            outcome: null,
            executions: [{ executionId: 'execution-1', status: 'running' }],
            cancellable: false,
          },
        ],
      ]),
    });

    const modelRow = byTestId('running-jobs-row').find(
      row => row.props['data-state'] === 'running'
    );
    expect(modelRow).toBeDefined();
    expect(modelRow!.findAllByProps({ 'data-testid': 'running-jobs-cancel' })).toHaveLength(0);
  });

  test('the confirmation reads in French', async () => {
    mockStrings = french;
    const repo = repository();
    repo.cancelProcessingRun.mockRejectedValue(new StudyProcessingRESTError('x', 500));
    await render({ processingRepository: repo });

    expect(byTestId('running-jobs-cancel')[0].props.title).toBe("Annuler l'analyse");
    await click('running-jobs-cancel');
    expect(rendered()).toContain('Annuler cette analyse ?');
    expect(rendered()).toContain('Oui, annuler');
    expect(rendered()).toContain('Les modèles déjà terminés conservent leurs résultats.');
    await click('running-jobs-cancel-yes');
    await settle();
    expect(rendered()).toContain('Annulation impossible. Réessayez.');
  });
});
