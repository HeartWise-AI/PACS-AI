import React from 'react';
import { render as rtlRender, type RenderResult } from '@testing-library/react';
import english from '@pacs-ai/extension-core/src/locales/en-US/AIModelButton.json';
import french from '@pacs-ai/extension-core/src/locales/fr/AIModelButton.json';
import { RunningJobsIndicator, type RunningJobsIndicatorProps } from './RunningJobsIndicator';
import {
  countRunningJobs,
  formatClockTime,
  processingRunState,
  processingRunWaiting,
  selectRunningJobs,
} from './runningJobsModel';
import { jobRow, pendingRun, processingRun, STUDY_UID, translate } from './testSupport';
import type { RunningJobRow } from './types';

let mockStrings: Record<string, string> = english;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      jest.requireActual('./testSupport').translate(mockStrings, key, options),
  }),
}));

const NOW = 1_065_000;

// The run of the report: three models done, three waiting, nothing computing.
function waitingRun(overrides: Parameters<typeof processingRun>[0] = {}) {
  return processingRun({
    phase: 'QUEUED',
    expectedModels: 6,
    pendingModels: 3,
    queuedModels: 0,
    runningModels: 0,
    completedModels: 3,
    skippedModels: 0,
    activeModels: 3,
    ...overrides,
  });
}

function processingRow(run: ReturnType<typeof processingRun>): RunningJobRow {
  const { rows } = selectRunningJobs({
    studyInstanceUID: STUDY_UID,
    pendingRuns: [],
    processingRun: run,
    processingRunEndedAt: run.phase === 'TERMINAL' ? NOW : null,
    now: NOW,
  });
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe('why a processing run is not progressing', () => {
  test('maps the reason reported by the backend', () => {
    expect(processingRunWaiting(waitingRun({ waitingReason: 'study_growing' }))).toBe('exam');
    expect(processingRunWaiting(waitingRun({ waitingReason: 'stale' }))).toBe('stale');
    // A backend that does not report a reason keeps the old wording.
    expect(processingRunWaiting(waitingRun())).toBeUndefined();
    expect(
      processingRunWaiting(waitingRun({ waitingReason: 'something_new' as never }))
    ).toBeUndefined();
  });

  test('a run that is computing or has ended is never waiting', () => {
    expect(
      processingRunWaiting(
        waitingRun({ phase: 'PROCESSING', runningModels: 1, waitingReason: 'study_growing' })
      )
    ).toBeUndefined();
    expect(
      processingRunWaiting(
        waitingRun({ phase: 'TERMINAL', outcome: 'PARTIAL_SUCCESS', waitingReason: 'stale' })
      )
    ).toBeUndefined();
  });

  test('the row carries the reason, the real count and the run to cancel', () => {
    const row = processingRow(waitingRun({ waitingReason: 'study_growing', cancellable: true }));

    expect(row).toMatchObject({
      kind: 'processing',
      state: 'queued',
      active: true,
      waiting: 'exam',
      progress: { done: 3, total: 6 },
      cancelRunId: 'auto-run-1',
    });
    expect(row.id).not.toContain(STUDY_UID);
  });

  test('an older backend yields the same row as before: no reason, no cancel', () => {
    const row = processingRow(waitingRun());

    expect(row.state).toBe('queued');
    expect(row).not.toHaveProperty('waiting');
    expect(row).not.toHaveProperty('cancelRunId');
  });

  test('cancel is offered only when the backend says the run is cancellable', () => {
    expect(processingRow(waitingRun({ cancellable: false }))).not.toHaveProperty('cancelRunId');
    // Computing, but with models still waiting: the backend decides.
    expect(
      processingRow(waitingRun({ phase: 'PROCESSING', runningModels: 1, cancellable: true }))
    ).toMatchObject({ state: 'running', cancelRunId: 'auto-run-1' });
    expect(
      processingRow(waitingRun({ phase: 'PROCESSING', runningModels: 1, cancellable: false }))
    ).not.toHaveProperty('cancelRunId');
    // An ended run is never cancellable, whatever a stale detail says.
    expect(
      processingRow(waitingRun({ phase: 'TERMINAL', outcome: 'SUCCESS', cancellable: true }))
    ).not.toHaveProperty('cancelRunId');
  });

  test('a run a user cancelled ends as cancelled, not failed or done', () => {
    const cancelledAt = '2026-11-10T10:05:00Z';
    expect(
      processingRunState(waitingRun({ phase: 'TERMINAL', outcome: 'CANCELLED', cancelledAt }))
    ).toBe('cancelled');
    expect(
      processingRunState(waitingRun({ phase: 'TERMINAL', outcome: 'PARTIAL_SUCCESS', cancelledAt }))
    ).toBe('cancelled');
    // Still computing its last model after the cancellation.
    expect(
      processingRunState(waitingRun({ phase: 'PROCESSING', runningModels: 1, cancelledAt }))
    ).toBe('running');
    // Without the new field the earlier mapping is kept.
    expect(processingRunState(waitingRun({ phase: 'TERMINAL', outcome: 'CANCELLED' }))).toBe(
      'failed'
    );
  });
});

describe('cancelling a run requested from the viewer', () => {
  const queued = { phase: 'QUEUED', outcome: null, executions: [] };

  function modelRow(status: Record<string, unknown>, run = pendingRun()) {
    return selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [run],
      pendingRunStatuses: new Map([[run, status as never]]),
      now: NOW,
    }).rows[0];
  }

  test('is offered while the run is queued and the backend reports it cancellable', () => {
    expect(modelRow({ ...queued, cancellable: true })).toMatchObject({
      state: 'queued',
      cancelRunId: 'run-1',
    });
    expect(modelRow({ ...queued, cancellable: false })).not.toHaveProperty('cancelRunId');
    expect(modelRow(queued)).not.toHaveProperty('cancelRunId');
  });

  test('is never offered once the model is computing', () => {
    const running = {
      phase: 'PROCESSING',
      outcome: null,
      executions: [{ executionId: 'execution-1', status: 'running' }],
      cancellable: true,
    };
    expect(modelRow(running)).toMatchObject({ state: 'running' });
    expect(modelRow(running)).not.toHaveProperty('cancelRunId');
  });

  test('is not offered for a run whose identifier is unknown', () => {
    const run = pendingRun({ runId: null, executionId: null });
    expect(modelRow({ ...queued, cancellable: true }, run)).not.toHaveProperty('cancelRunId');
  });

  test('a cancelled run lingers as cancelled', () => {
    const run = pendingRun();
    const { rows } = selectRunningJobs({
      studyInstanceUID: STUDY_UID,
      pendingRuns: [],
      endedRuns: [{ run, outcome: 'cancelled', result: null, endedAt: NOW, foreground: false }],
      now: NOW + 1000,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'cancelled', active: false, result: null });
  });
});

describe('pill counts', () => {
  test('separates runs that compute from runs that only wait', () => {
    expect(
      countRunningJobs([
        jobRow(),
        jobRow({ state: 'queued' }),
        jobRow({ state: 'queued', waiting: 'exam' }),
        jobRow({ state: 'queued', waiting: 'stale' }),
        // Ended rows count for nothing, whatever they carry.
        jobRow({ state: 'cancelled', active: false, waiting: 'exam' }),
        jobRow({ state: 'done', active: false }),
      ])
    ).toEqual({ running: 2, waiting: 2, stale: 1 });
    expect(countRunningJobs([])).toEqual({ running: 0, waiting: 0, stale: 0 });
  });
});

describe('formatClockTime', () => {
  test('gives the local wall-clock time as HH:MM', () => {
    const time = new Date(2026, 10, 16, 9, 5, 42).getTime();
    expect(formatClockTime(time)).toBe('09:05');
    expect(formatClockTime(new Date(2026, 10, 16, 23, 59).getTime())).toBe('23:59');
    expect(formatClockTime(Number.NaN)).toBe('--:--');
  });
});

describe('RunningJobsIndicator: waiting runs', () => {
  let renderer: RenderResult | null = null;
  const STARTED = new Date(2026, 10, 16, 10, 2, 30).getTime();

  function render(rows: RunningJobRow[], props: Partial<RunningJobsIndicatorProps> = {}) {
    renderer = rtlRender(
      <RunningJobsIndicator
        rows={rows}
        now={STARTED + 25 * 60_000 + 27_000}
        collapsed={false}
        onToggleCollapsed={jest.fn()}
        onClose={jest.fn()}
        {...props}
      />
    );
  }

  const byTestId = (id: string) =>
    Array.from(renderer!.container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  const text = (node: Element): string => node.textContent ?? '';
  const cardText = () => text(byTestId('running-jobs-indicator')[0]);

  const examRow = (overrides: Partial<RunningJobRow> = {}) =>
    jobRow({
      id: 'processing:auto-run-1',
      kind: 'processing',
      modelName: null,
      trigger: 'AUTO',
      state: 'queued',
      startedAt: STARTED,
      progress: { done: 3, total: 6 },
      waiting: 'exam',
      ...overrides,
    });

  beforeEach(() => {
    mockStrings = english;
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  test('says the run waits for the exam, calmly, with its real count', () => {
    render([examRow()]);

    const [row] = byTestId('running-jobs-row');
    expect(row.getAttribute('data-state')).toBe('queued');
    expect(row.getAttribute('data-waiting')).toBe('exam');
    expect(text(row)).toContain('Automatic analysis');
    expect(text(row)).toContain('Waiting for the exam to finish');
    expect(text(row)).toContain('3 of 6 models');
    expect(text(row)).not.toContain('Queued');

    // No spinner anywhere, and no ticking timer: a start time instead.
    expect(byTestId('running-jobs-spinner')).toHaveLength(0);
    expect(
      byTestId('running-jobs-waiting-mark').map(mark => mark.getAttribute('data-waiting'))
    ).toEqual(['exam', 'exam']);
    expect(byTestId('running-jobs-elapsed')).toHaveLength(0);
    expect(renderer!.container.querySelectorAll('[role="timer"]')).toHaveLength(0);
    expect(text(byTestId('running-jobs-since')[0])).toBe('since 10:02');
    expect(text(row)).not.toContain('25:27');
    expect(byTestId('running-jobs-state')[0].className).toContain('text-white/70');
    // The count keeps its bar, without the "computing" colour.
    const [bar] = byTestId('running-jobs-progress');
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.children[0].className).toContain('bg-white/40');

    expect(cardText()).toContain('1 waiting');
    expect(cardText()).not.toContain('running');
  });

  test('warns about a run that is stuck', () => {
    render([examRow({ waiting: 'stale' })]);

    const [row] = byTestId('running-jobs-row');
    expect(row.getAttribute('data-waiting')).toBe('stale');
    expect(text(row)).toContain('Stuck — not started');
    expect(text(row)).toContain('3 of 6 models');
    expect(byTestId('running-jobs-state')[0].className).toContain('text-amber-300');
    const marks = byTestId('running-jobs-waiting-mark');
    expect(marks.map(mark => mark.getAttribute('data-waiting'))).toEqual(['stale', 'stale']);
    expect(marks[1].className).toContain('border-amber-300');
    expect(byTestId('running-jobs-spinner')).toHaveLength(0);
  });

  test('the pill does not count a run that only waits as running', () => {
    render([examRow()], { collapsed: true });
    let [pill] = byTestId('running-jobs-pill');
    expect(text(pill)).toBe('1 waiting');
    expect(pill.getAttribute('aria-label')).toBe('Show AI analysis status (1 waiting)');
    expect(byTestId('running-jobs-spinner')).toHaveLength(0);
    expect(byTestId('running-jobs-waiting-mark')).toHaveLength(1);

    render([examRow(), jobRow({ id: 'model:run-2' })], { collapsed: true });
    [pill] = byTestId('running-jobs-pill');
    expect(text(pill)).toBe('1 running · 1 waiting');
    // Something is computing: the pill spins.
    expect(byTestId('running-jobs-spinner')).toHaveLength(1);
    expect(byTestId('running-jobs-waiting-mark')).toHaveLength(0);

    render([examRow(), examRow({ id: 'processing:other', waiting: 'stale' })], { collapsed: true });
    [pill] = byTestId('running-jobs-pill');
    expect(text(pill)).toBe('2 waiting');
    expect(byTestId('running-jobs-waiting-mark')[0].getAttribute('data-waiting')).toBe('stale');
  });

  test('an ended row ignores a waiting reason left on it', () => {
    render([examRow({ state: 'cancelled', active: false, endedAt: STARTED + 60_000 })]);

    const [row] = byTestId('running-jobs-row');
    expect(row.getAttribute('data-state')).toBe('cancelled');
    expect(text(row)).toContain('Cancelled');
    expect(text(row)).not.toContain('Waiting for the exam');
    expect(byTestId('running-jobs-waiting-mark')).toHaveLength(0);
    expect(byTestId('running-jobs-progress')).toHaveLength(0);
    expect(cardText()).toContain('Finished');
  });

  test('renders the new states in French', () => {
    mockStrings = french;
    render([
      examRow(),
      examRow({ id: 'processing:other', waiting: 'stale' }),
      jobRow({ id: 'model:run-9', state: 'cancelled', active: false, endedAt: STARTED }),
    ]);

    const rows = byTestId('running-jobs-row');
    expect(text(rows[0])).toContain("En attente de la fin de l'examen");
    expect(text(rows[0])).toContain('3 sur 6 modèles');
    expect(text(rows[0])).toContain('depuis 10:02');
    expect(text(rows[1])).toContain('Bloqué — non démarré');
    expect(text(rows[2])).toContain('Annulé');
    expect(cardText()).toContain('2 en attente');
  });

  test('French strings of the waiting and cancel states', () => {
    const expected: Record<string, string> = {
      RunningJobsCountWaiting: '{{total}} en attente',
      RunningJobsStateWaitingExam: "En attente de la fin de l'examen",
      RunningJobsStateStale: 'Bloqué — non démarré',
      RunningJobsStateCancelled: 'Annulé',
      RunningJobsWaitingSince: 'depuis {{time}}',
      RunningJobsCancel: "Annuler l'analyse",
      RunningJobsCancelConfirm: 'Annuler cette analyse ?',
      RunningJobsCancelConfirmYes: 'Oui, annuler',
      RunningJobsCancelConfirmNo: 'Non',
      RunningJobsCancelling: 'Annulation…',
    };
    Object.entries(expected).forEach(([key, value]) => {
      expect((french as Record<string, string>)[key]).toBe(value);
    });
    expect(translate(french, 'RunningJobsCountWaiting', { total: 1 })).toBe('1 en attente');
    expect((english as Record<string, string>).RunningJobsStateWaitingExam).toBe(
      'Waiting for the exam to finish'
    );
    expect((english as Record<string, string>).RunningJobsCancel).toBe('Cancel analysis');
    ['RunningJobsCancelKeepsResults', 'RunningJobsCancelError', 'RunningJobsCancelTooLate'].forEach(
      key => {
        expect((french as Record<string, string>)[key]).toBeTruthy();
        expect((french as Record<string, string>)[key]).not.toBe(
          (english as Record<string, string>)[key]
        );
      }
    );
  });
});
