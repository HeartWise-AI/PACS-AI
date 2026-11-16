import type { ModelExecution } from '../studyProcessing/types';
import {
  formatElapsed,
  pendingRunState,
  processingRunProgress,
  processingRunState,
  RUNNING_JOBS_LINGER_MS,
  rowElapsedMs,
  selectRunningJobs,
} from './runningJobsModel';
import { pendingRun, processingRun, STUDY_UID, viewerResult } from './testSupport';

const NOW = 1_060_000;

function execution(overrides: Partial<ModelExecution> = {}): ModelExecution {
  return {
    id: 'execution-a',
    modelName: 'Model A',
    modelVersion: null,
    modality: null,
    status: 'running',
    skipReason: null,
    error: null,
    queuedAt: null,
    startedAt: null,
    completedAt: null,
    updatedAt: '2026-11-10T10:00:00Z',
    ...overrides,
  };
}

describe('formatElapsed', () => {
  test.each([
    [0, '00:00'],
    [999, '00:00'],
    [1000, '00:01'],
    [65_000, '01:05'],
    [59 * 60_000 + 59_000, '59:59'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
    [-5000, '00:00'],
    [Number.NaN, '00:00'],
  ])('%p ms reads %s', (elapsed, expected) => {
    expect(formatElapsed(elapsed)).toBe(expected);
  });

  test('a finished row stops counting at its end time', () => {
    expect(rowElapsedMs({ startedAt: 1000, endedAt: null }, 5000)).toBe(4000);
    expect(rowElapsedMs({ startedAt: 1000, endedAt: 3000 }, 5000)).toBe(2000);
    // Server clock ahead of the browser.
    expect(rowElapsedMs({ startedAt: 9000, endedAt: null }, 5000)).toBe(0);
  });
});

describe('pendingRunState', () => {
  const run = pendingRun();

  test('is queued until the first status, running when the ids are unknown', () => {
    expect(pendingRunState(run, undefined)).toBe('queued');
    expect(pendingRunState(pendingRun({ runId: null, executionId: null }), undefined)).toBe(
      'running'
    );
  });

  test.each([
    ['pending', 'queued'],
    ['queued', 'queued'],
    ['RUNNING', 'running'],
    ['completed', 'finishing'],
  ])('maps the execution status %s to %s', (status, expected) => {
    expect(
      pendingRunState(run, {
        phase: 'PROCESSING',
        outcome: null,
        executions: [
          { executionId: 'other', status: 'failed' },
          { executionId: 'execution-1', status },
        ],
      })
    ).toBe(expected);
  });

  test.each([
    ['QUEUED', 'queued'],
    ['PROCESSING', 'running'],
    ['TERMINAL', 'finishing'],
    [null, 'running'],
  ])('falls back to the run phase %s', (phase, expected) => {
    expect(pendingRunState(run, { phase, outcome: null, executions: [] })).toBe(expected);
  });

  test('uses the only execution when the execution id is unknown', () => {
    expect(
      pendingRunState(pendingRun({ executionId: null }), {
        phase: 'PROCESSING',
        outcome: null,
        executions: [{ executionId: 'x', status: 'queued' }],
      })
    ).toBe('queued');
  });
});

describe('processing run state and progress', () => {
  test('maps phases and outcomes', () => {
    expect(processingRunState(processingRun({ phase: 'QUEUED' }))).toBe('queued');
    expect(processingRunState(processingRun())).toBe('running');
    expect(
      processingRunState(
        processingRun({ queuedModels: 0, runningModels: 0, completedModels: 6, skippedModels: 1 })
      )
    ).toBe('finishing');
    expect(processingRunState(processingRun({ phase: 'TERMINAL', outcome: 'SUCCESS' }))).toBe(
      'done'
    );
    expect(
      processingRunState(processingRun({ phase: 'TERMINAL', outcome: 'PARTIAL_SUCCESS' }))
    ).toBe('done');
    expect(processingRunState(processingRun({ phase: 'TERMINAL', outcome: 'FAILED' }))).toBe(
      'failed'
    );
    expect(processingRunState(processingRun({ phase: 'TERMINAL', outcome: 'CANCELLED' }))).toBe(
      'failed'
    );
    expect(processingRunState(processingRun({ phase: 'TERMINAL', outcome: 'NO_RESULT' }))).toBe(
      'skipped'
    );
  });

  test('counts ended models of the expected ones and never invents a total', () => {
    expect(processingRunProgress(processingRun())).toEqual({ done: 2, total: 7 });
    expect(
      processingRunProgress(
        processingRun({ completedModels: 9, failedModels: 1, cancelledModels: 1 })
      )
    ).toEqual({ done: 7, total: 7 });
    expect(processingRunProgress(processingRun({ expectedModels: 0 }))).toBeNull();
  });
});

describe('selectRunningJobs', () => {
  test('shows nothing when idle or without a study', () => {
    expect(selectRunningJobs({ studyInstanceUID: STUDY_UID, pendingRuns: [], now: NOW })).toEqual({
      rows: [],
      activeCount: 0,
    });
    expect(
      selectRunningJobs({ studyInstanceUID: null, pendingRuns: [pendingRun()], now: NOW }).rows
    ).toEqual([]);
  });

  test('shows only the runs of the open study, with their polled state', () => {
    const mine = pendingRun();
    const other = pendingRun({ key: 'container-2', studyInstanceUID: '9.9.9', runId: 'run-9' });
    const { rows, activeCount } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [mine, other],
      pendingRunStatuses: new Map([
        [
          mine,
          {
            phase: 'PROCESSING',
            outcome: null,
            executions: [{ executionId: 'execution-1', status: 'running' }],
          },
        ],
      ]),
      now: NOW,
    });

    expect(activeCount).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'model',
      modelName: 'DeepCORO',
      state: 'running',
      active: true,
      startedAt: 1_000_000,
      endedAt: null,
      progress: null,
    });
    expect(rows[0].id).not.toContain(STUDY_UID);
  });

  test('hides the run the foreground pop-up is showing', () => {
    const foreground = pendingRun();
    const background = pendingRun({ key: 'container-2', modelName: 'EchoPrime', runId: 'run-2' });
    const { rows } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [foreground, background],
      foregroundRun: foreground,
      // The same run reported as the study's processing run is not shown either.
      processingRun: processingRun({ id: 'run-1', trigger: 'VIEWER_REQUEST', expectedModels: 1 }),
      now: NOW,
    });

    expect(rows.map(row => row.modelName)).toEqual(['EchoPrime']);
  });

  test('keeps an ended run for a few seconds, then drops it', () => {
    const run = pendingRun();
    const result = viewerResult();
    const input = {
      studyInstanceUID: STUDY_UID,
      pendingRuns: [],
      endedRuns: [
        { run, outcome: 'completed' as const, result, endedAt: NOW, foreground: false },
        {
          run: pendingRun({ key: 'container-2', modelName: 'EchoPrime', runId: 'run-2' }),
          outcome: 'skipped' as const,
          result: null,
          endedAt: NOW,
          foreground: false,
        },
        {
          run: pendingRun({ key: 'container-3', modelName: 'CathEF', runId: 'run-3' }),
          outcome: 'failed' as const,
          result: null,
          endedAt: NOW,
          foreground: false,
        },
        {
          run: pendingRun({ key: 'container-4', modelName: 'Waited', runId: 'run-4' }),
          outcome: 'completed' as const,
          result,
          endedAt: NOW,
          foreground: true,
        },
      ],
    };

    const shown = selectRunningJobs({ ...input, now: NOW + RUNNING_JOBS_LINGER_MS - 1 });
    expect(shown.activeCount).toBe(0);
    expect(shown.rows.map(row => [row.modelName, row.state])).toEqual([
      ['DeepCORO', 'done'],
      ['EchoPrime', 'skipped'],
      ['CathEF', 'failed'],
    ]);
    expect(shown.rows[0].result).toBe(result);
    expect(shown.rows[0].endedAt).toBe(NOW);
    expect(shown.rows[1].result).toBeNull();

    expect(selectRunningJobs({ ...input, now: NOW + RUNNING_JOBS_LINGER_MS }).rows).toEqual([]);
  });

  test('a new run of the same model replaces its finished row', () => {
    const ended = pendingRun();
    const rerun = pendingRun({ runId: 'run-2', requestedAt: NOW });
    const { rows } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [rerun],
      endedRuns: [
        {
          run: ended,
          outcome: 'completed',
          result: viewerResult(),
          endedAt: NOW,
          foreground: false,
        },
      ],
      now: NOW + 1000,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'queued', active: true });
  });

  test('shows a server processing run with its counts and running models', () => {
    const { rows, activeCount } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [],
      processingRun: processingRun({
        startedAt: '2026-11-10T10:00:10Z',
        modelExecutions: [
          execution(),
          execution({ id: 'execution-b', modelName: 'Model B', status: 'queued' }),
          execution({ id: 'execution-c', modelName: 'Model C', status: 'running' }),
        ],
      }),
      processingRunSeenAt: NOW - 5000,
      now: NOW,
    });

    expect(activeCount).toBe(1);
    expect(rows).toEqual([
      {
        id: 'processing:auto-run-1',
        kind: 'processing',
        modelName: null,
        trigger: 'AUTO',
        state: 'running',
        active: true,
        startedAt: Date.parse('2026-11-10T10:00:10Z'),
        endedAt: null,
        progress: { done: 2, total: 7 },
        runningModelNames: ['Model A', 'Model C'],
        result: null,
      },
    ]);
  });

  test('names a single-model processing run after its model', () => {
    const { rows } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [],
      processingRun: processingRun({
        trigger: 'VIEWER_REQUEST',
        expectedModels: 1,
        queuedModels: 0,
        runningModels: 1,
        completedModels: 0,
        skippedModels: 0,
        modelExecutions: [execution()],
      }),
      now: NOW,
    });

    expect(rows[0]).toMatchObject({ modelName: 'Model A', progress: null, runningModelNames: [] });
  });

  test('keeps a processing run seen ending for a few seconds only', () => {
    const input = {
      studyInstanceUID: STUDY_UID,
      pendingRuns: [],
      processingRun: processingRun({ phase: 'TERMINAL', outcome: 'SUCCESS_WITH_SKIPS' }),
      processingRunEndedAt: NOW,
    } as const;

    const shown = selectRunningJobs({ ...input, pendingRuns: [], now: NOW + 1000 });
    expect(shown.rows[0]).toMatchObject({ state: 'done', active: false, endedAt: NOW });
    expect(shown.activeCount).toBe(0);
    expect(
      selectRunningJobs({ ...input, pendingRuns: [], now: NOW + RUNNING_JOBS_LINGER_MS }).rows
    ).toEqual([]);
    // A run that was already finished when the study was opened is not shown.
    expect(
      selectRunningJobs({ ...input, pendingRuns: [], processingRunEndedAt: null, now: NOW }).rows
    ).toEqual([]);
  });

  test('ignores a processing run of another study', () => {
    expect(
      selectRunningJobs({
        studyInstanceUID: STUDY_UID,
        pendingRuns: [],
        processingRun: processingRun({ studyInstanceUID: '9.9.9' }),
        now: NOW,
      }).rows
    ).toEqual([]);
  });

  test('shows a viewer run and an unrelated automatic run side by side', () => {
    const { rows, activeCount } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [pendingRun()],
      processingRun: processingRun(),
      now: NOW,
    });

    expect(rows.map(row => row.kind)).toEqual(['model', 'processing']);
    expect(activeCount).toBe(2);
  });

  test('does not repeat an already-active viewer run as a processing row', () => {
    const { rows } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [pendingRun({ runId: null, executionId: null })],
      processingRun: processingRun({ trigger: 'VIEWER_REQUEST', expectedModels: 1 }),
      now: NOW,
    });

    expect(rows.map(row => row.kind)).toEqual(['model']);
  });
});
