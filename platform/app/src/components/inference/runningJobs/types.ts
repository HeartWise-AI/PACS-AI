import type { ViewerModelResult } from '../viewerResults/types';

export type RunningJobState = 'queued' | 'running' | 'finishing' | 'done' | 'failed' | 'skipped';

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
}

export interface RunningJobsSummary {
  rows: RunningJobRow[];
  activeCount: number;
}
