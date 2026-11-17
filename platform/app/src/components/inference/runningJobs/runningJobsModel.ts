import type {
  EndedViewerModelRun,
  PendingViewerModelRun,
  ViewerModelRunStatus,
} from '../viewerResults/types';
import type { ProcessingRun } from '@pacs-ai/extension-core/src/studyProcessing/types';
import type {
  RunningJobRow,
  RunningJobState,
  RunningJobWaiting,
  RunningJobsCounts,
  RunningJobsSummary,
} from './types';

// How long a finished row stays visible.
export const RUNNING_JOBS_LINGER_MS = 6_000;

const ACTIVE_STATES: RunningJobState[] = ['queued', 'running', 'finishing'];

export function isRunningJobStateActive(state: RunningJobState): boolean {
  return ACTIVE_STATES.includes(state);
}

/** mm:ss, or h:mm:ss from one hour. Negative or invalid durations read 00:00. */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Local wall-clock time, HH:MM (24 h). Invalid times read --:--. */
export function formatClockTime(timeMs: number): string {
  const date = new Date(timeMs);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Active rows split into those computing (or about to) and those only waiting. */
export function countRunningJobs(
  rows: Pick<RunningJobRow, 'active' | 'waiting'>[]
): RunningJobsCounts {
  const active = rows.filter(row => row.active);
  const waiting = active.filter(row => !!row.waiting);
  return {
    running: active.length - waiting.length,
    waiting: waiting.length,
    stale: waiting.filter(row => row.waiting === 'stale').length,
  };
}

export function rowElapsedMs(row: Pick<RunningJobRow, 'startedAt' | 'endedAt'>, now: number) {
  return Math.max(0, (row.endedAt ?? now) - row.startedAt);
}

/**
 * State of a run requested from the viewer, from the run detail the results
 * provider already polls. Without a status yet the run has just been accepted
 * (queued), or was already active when requested (running, ids unknown).
 */
export function pendingRunState(
  run: Pick<PendingViewerModelRun, 'runId' | 'executionId'>,
  status: ViewerModelRunStatus | null | undefined
): RunningJobState {
  if (!status) {
    return run.runId ? 'queued' : 'running';
  }

  const execution = run.executionId
    ? status.executions.find(item => item.executionId === run.executionId)
    : status.executions.length === 1
      ? status.executions[0]
      : undefined;

  switch (execution?.status?.toLowerCase()) {
    case 'pending':
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'completed':
      // The model is done; its result is being stored.
      return 'finishing';
    default:
      break;
  }

  switch (status.phase?.toUpperCase()) {
    case 'QUEUED':
      return 'queued';
    case 'TERMINAL':
      return 'finishing';
    default:
      return 'running';
  }
}

type ProcessingRunCounts = Pick<
  ProcessingRun,
  | 'phase'
  | 'outcome'
  | 'expectedModels'
  | 'pendingModels'
  | 'queuedModels'
  | 'runningModels'
  | 'completedModels'
  | 'failedModels'
  | 'skippedModels'
  | 'cancelledModels'
> &
  Pick<ProcessingRun, 'cancelledAt' | 'waitingReason'>;

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Models of the run that have ended, whatever their result. */
export function processingRunEndedModels(run: ProcessingRunCounts): number {
  return (
    count(run.completedModels) +
    count(run.failedModels) +
    count(run.skippedModels) +
    count(run.cancelledModels)
  );
}

export function processingRunState(run: ProcessingRunCounts): RunningJobState {
  if (run.phase === 'TERMINAL') {
    if (run.cancelledAt) {
      // Cancelled by a user, whatever the models that had already finished.
      return 'cancelled';
    }
    switch (run.outcome) {
      case 'FAILED':
      case 'CANCELLED':
        return 'failed';
      case 'NO_RESULT':
        return 'skipped';
      default:
        return 'done';
    }
  }

  if (run.phase === 'QUEUED') {
    return 'queued';
  }

  const expected = count(run.expectedModels);
  const waiting = count(run.pendingModels) + count(run.queuedModels) + count(run.runningModels);
  return expected > 0 && waiting === 0 && processingRunEndedModels(run) >= expected
    ? 'finishing'
    : 'running';
}

/**
 * Why an active run is not computing, when the backend says so. A run with a
 * model running is never waiting, whatever is reported.
 */
export function processingRunWaiting(run: ProcessingRunCounts): RunningJobWaiting | undefined {
  if (run.phase === 'TERMINAL' || count(run.runningModels) > 0) {
    return undefined;
  }
  switch (run.waitingReason) {
    case 'study_growing':
      return 'exam';
    case 'stale':
      return 'stale';
    default:
      return undefined;
  }
}

/** "N of M" for a run of several models; null when the backend gives no total. */
export function processingRunProgress(run: ProcessingRunCounts) {
  const total = count(run.expectedModels);
  if (total < 1) {
    return null;
  }
  return { done: Math.min(processingRunEndedModels(run), total), total };
}

function parseTime(value: string | null | undefined): number | null {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : time;
}

export interface SelectRunningJobsInput {
  studyInstanceUID: string | null;
  pendingRuns: PendingViewerModelRun[];
  pendingRunStatuses?: ReadonlyMap<PendingViewerModelRun, ViewerModelRunStatus>;
  endedRuns?: EndedViewerModelRun[];
  // The run the foreground "Running…" pop-up is showing, if any.
  foregroundRun?: PendingViewerModelRun | null;
  // The study's server processing run, as last polled.
  processingRun?: ProcessingRun | null;
  // When this client first saw the processing run / saw it end.
  processingRunSeenAt?: number | null;
  processingRunEndedAt?: number | null;
  now: number;
  lingerMs?: number;
}

export function pendingRunRowId(run: PendingViewerModelRun): string {
  return `model:${run.runId ?? 'active'}:${run.key}:${run.requestedAt}`;
}

/**
 * Rows of the indicator for the study open in the viewer: runs requested from
 * the viewer that are still pending, the study's server processing run while
 * it is active, and both for `lingerMs` after they end.
 */
export function selectRunningJobs({
  studyInstanceUID,
  pendingRuns,
  pendingRunStatuses,
  endedRuns = [],
  foregroundRun = null,
  processingRun = null,
  processingRunSeenAt = null,
  processingRunEndedAt = null,
  now,
  lingerMs = RUNNING_JOBS_LINGER_MS,
}: SelectRunningJobsInput): RunningJobsSummary {
  const uid = studyInstanceUID?.trim();
  if (!uid) {
    return { rows: [], activeCount: 0 };
  }

  const rows: RunningJobRow[] = [];
  const studyPendingRuns = pendingRuns.filter(run => run.studyInstanceUID === uid);

  endedRuns
    .filter(
      ended =>
        ended.run.studyInstanceUID === uid &&
        // The pop-up already showed how a run the user waited on ended.
        !ended.foreground &&
        now - ended.endedAt < lingerMs &&
        // A newer run of the same model replaces the finished row.
        !studyPendingRuns.some(run => run.key === ended.run.key)
    )
    .forEach(ended => {
      rows.push({
        id: pendingRunRowId(ended.run),
        kind: 'model',
        modelName: ended.run.modelName,
        trigger: 'VIEWER_REQUEST',
        state:
          ended.outcome === 'completed'
            ? 'done'
            : ended.outcome === 'skipped'
              ? 'skipped'
              : ended.outcome === 'cancelled'
                ? 'cancelled'
                : 'failed',
        active: false,
        startedAt: ended.run.requestedAt,
        endedAt: ended.endedAt,
        progress: null,
        runningModelNames: [],
        result: ended.outcome === 'completed' ? ended.result : null,
      });
    });

  studyPendingRuns
    // The foreground pop-up is already showing this run.
    .filter(run => run !== foregroundRun)
    .forEach(run => {
      const status = pendingRunStatuses?.get(run);
      const state = pendingRunState(run, status);
      rows.push({
        id: pendingRunRowId(run),
        kind: 'model',
        modelName: run.modelName,
        trigger: 'VIEWER_REQUEST',
        state,
        active: true,
        startedAt: run.requestedAt,
        endedAt: null,
        progress: null,
        runningModelNames: [],
        result: null,
        // Never offered once the model is computing, whatever is reported.
        ...(run.runId && state === 'queued' && status?.cancellable === true
          ? { cancelRunId: run.runId }
          : {}),
      });
    });

  if (processingRun && processingRun.studyInstanceUID === uid) {
    const state = processingRunState(processingRun);
    const active = isRunningJobStateActive(state);
    const viewerRunIds = [
      ...studyPendingRuns.map(run => run.runId),
      ...endedRuns.map(ended => ended.run.runId),
    ];
    // A run requested from the viewer is a processing run too: it is shown
    // once, as its model row. A viewer run whose ids are unknown (it was
    // already active) is the study's single-model viewer run.
    const shownAsModelRow =
      viewerRunIds.includes(processingRun.id) ||
      (processingRun.trigger === 'VIEWER_REQUEST' &&
        studyPendingRuns.some(run => !run.runId) &&
        processingRun.expectedModels <= 1);
    const lingering =
      !active && processingRunEndedAt !== null && now - processingRunEndedAt < lingerMs;

    if (!shownAsModelRow && (active || lingering)) {
      const startedAt =
        parseTime(processingRun.startedAt) ??
        parseTime(processingRun.createdAt) ??
        processingRunSeenAt ??
        now;
      const executions = processingRun.modelExecutions ?? [];
      const single = processingRun.expectedModels === 1 && executions.length === 1;
      const waiting = active ? processingRunWaiting(processingRun) : undefined;
      rows.push({
        id: `processing:${processingRun.id}`,
        kind: 'processing',
        modelName: single ? executions[0].modelName : null,
        trigger: processingRun.trigger ?? null,
        state,
        active,
        startedAt,
        endedAt: active ? null : (processingRunEndedAt ?? now),
        progress: single ? null : processingRunProgress(processingRun),
        runningModelNames: single
          ? []
          : executions
              .filter(execution => execution.status === 'running')
              .map(execution => execution.modelName),
        result: null,
        ...(waiting ? { waiting } : {}),
        ...(active && processingRun.cancellable === true ? { cancelRunId: processingRun.id } : {}),
      });
    }
  }

  return { rows, activeCount: rows.filter(row => row.active).length };
}
