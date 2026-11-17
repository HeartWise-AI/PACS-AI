import type { ViewerModelResult } from '../viewerResults/types';

export type RunningJobState =
  | 'queued'
  | 'running'
  | 'finishing'
  | 'done'
  | 'failed'
  | 'skipped'
  // The user cancelled the run from the indicator.
  | 'cancelled';

// Why an active run computes nothing: 'exam' while the study still receives
// images (the exam is in progress), 'stale' when its models were never started.
export type RunningJobWaiting = 'exam' | 'stale';

// 'model': one model run requested from the viewer. 'processing': a server
// processing run of the study (automatic or reprocess), usually several models.
export type RunningJobKind = 'model' | 'processing';

// Counts reported by the backend for a processing run. Never estimated.
export interface RunningJobProgress {
  done: number;
  total: number;
}

export interface RunningJobRow {
  // Stable across polls; never contains a patient or study identifier.
  id: string;
  kind: RunningJobKind;
  // Model name for 'model' rows; null for 'processing' rows, which are
  // titled from the trigger.
  modelName: string | null;
  trigger: string | null;
  state: RunningJobState;
  active: boolean;
  // Epoch milliseconds the elapsed time counts from.
  startedAt: number;
  // Epoch milliseconds the run ended (elapsed time stops there), else null.
  endedAt: number | null;
  progress: RunningJobProgress | null;
  // Names of the models running right now in a 'processing' row.
  runningModelNames: string[];
  // Stored result a finished 'model' row opens, when there is one.
  result: ViewerModelResult | null;
  // Set only when the backend says why the active run is not computing.
  waiting?: RunningJobWaiting;
  // Backend run to cancel; set only while the backend reports it cancellable.
  cancelRunId?: string;
}

// Where the inline cancellation of a row stands.
export interface RunningJobCancelState {
  phase: 'confirming' | 'submitting' | 'error' | 'cancelled';
  // With 'error': 'tooLate' when the run started computing meanwhile.
  error?: 'failed' | 'tooLate';
  // With 'cancelled': epoch milliseconds the cancellation was confirmed.
  at?: number;
}

export interface RunningJobsCounts {
  // Active rows that are computing or about to.
  running: number;
  // Active rows that only wait (exam in progress, or never started).
  waiting: number;
  stale: number;
}

export interface RunningJobsSummary {
  rows: RunningJobRow[];
  activeCount: number;
}
