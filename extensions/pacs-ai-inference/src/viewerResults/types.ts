// Viewer previous results (cross-service contract v1, section 4/5).
// All fields beyond the identifiers are optional on the wire: the backend
// pieces ship independently, so every mapper tolerates their absence.

export interface SelectedView {
  sopInstanceUID: string | null;
  seriesInstanceUID: string | null;
  viewLabel: string | null;
  order: number;
  role: string | null;
  extra: Record<string, unknown> | null;
}

export interface ViewerModelResult {
  studyInstanceUID: string;
  modelName: string;
  modelVersion: string | null;
  modality: string | null;
  // Firestore registration id of the tenant's model, when one matches.
  modelId: string | null;
  // model-info modelId (what /model/proxy/available returns as modelId).
  artifactModelId: string | null;
  containerId: string | null;
  runId: string | null;
  executionId: string | null;
  studyServiceJobId: string | null;
  completedAt: string | null;
  trigger: string | null;
  // null means the run did not record its selection (old runs, models
  // without a selection step); [] means it recorded an empty selection.
  selectedViews: SelectedView[] | null;
  reportAvailable: boolean;
  // Series the run was dispatched with. A run requested from the viewer
  // records its list whether or not series were picked; null means no list
  // was recorded and the run used every series of the modality; undefined
  // means the backend does not report it.
  dispatchSeriesInstanceUIDs?: string[] | null;
  // Videos the run was given and the ones it could use; null when the run
  // recorded none, undefined when the backend does not report them.
  inputVideoCount?: number | null;
  eligibleVideoCount?: number | null;
  // The model's completed runs for the study, newest first, this result's own
  // run included. Present on a result reported by latest-results (the default,
  // "best" run); absent on a listed run and when the backend lists no runs.
  runs?: ViewerModelResult[];
  // On a listed run: whether it is the run reported by default (the one that
  // used the most eligible videos; the newest on a tie or unknown count).
  bestRun?: boolean;
  // Free-text labels of the run as typed, oldest first ("DIAGNOSTIC",
  // "post PCI"). Undefined when the backend does not report labels.
  labels?: string[];
  // True for a result built from a run that has just completed, before the
  // backend lists it: enough to open its report, replaced once it is listed.
  provisional?: boolean;
}

export interface ResultSeriesInfo {
  seriesInstanceUID: string;
  seriesNumber: string | null;
  description: string | null;
}

// The input a result was computed from, as the viewer can describe it from the
// DICOM metadata it has loaded: shown first in the result drawer.
export interface ResultInputSeries {
  seriesInstanceUID: string;
  seriesNumber: string | null;
  description: string | null;
  // "YYYY-MM-DD HH:MM" from the series' acquisition date and time.
  acquiredAt: string | null;
}

export interface ResultInput {
  // views: the views the model selected; dispatched: the series the run was
  // given; all: every eligible series of the model's modality.
  source: 'views' | 'dispatched' | 'all';
  // The input series the viewer has loaded, by series number.
  series: ResultInputSeries[];
  // How many series the run used (may exceed the loaded ones).
  seriesCount: number;
  // DICOM modality of the input series, when known ("XA").
  modality: string | null;
  // "YYYY-MM-DD".
  studyDate: string | null;
  // Earliest and latest acquisition of the input series, "YYYY-MM-DD HH:MM".
  acquiredFrom: string | null;
  acquiredTo: string | null;
}

// Which series a stored result covers, compared with the series loaded in the
// viewer. `series` lists the used series the viewer knows, for display.
export type ResultSeriesScope =
  | { kind: 'all'; series: ResultSeriesInfo[] }
  | { kind: 'subset'; used: number; total: number; series: ResultSeriesInfo[] }
  // The viewer has none of the used series loaded, so the total is unknown.
  | { kind: 'count'; used: number; series: ResultSeriesInfo[] };

// The part of a processing run's detail used to notice that a pending run
// ended without producing a result.
export interface ViewerModelRunExecution {
  executionId: string | null;
  status: string | null;
  // Why the execution produced no result, when the backend says so.
  errorMessage?: string | null;
  skipReasonCode?: string | null;
  skipReasonMessage?: string | null;
  completedAt?: string | null;
}

export interface ViewerModelRunStatus {
  phase: string | null;
  outcome: string | null;
  executions: ViewerModelRunExecution[];
  // True while the run can still be cancelled; absent when the backend does
  // not report it.
  cancellable?: boolean;
}

export type PendingRunFailure = 'failed' | 'skipped' | 'cancelled';

// How a pending run ended according to its run detail. `reason` is the
// backend's explanation (skip reason, error message) when it gives one.
export type PendingRunEnd =
  | { kind: 'completed'; completedAt: string | null }
  | { kind: PendingRunFailure; reason: string | null };

export interface ViewerModelRun {
  runId: string;
  runNumber: number | null;
  trigger: string | null;
  executionId: string | null;
  modelName: string | null;
  modelVersion: string | null;
}

// The subset of an available-model entry used for matching; kept structural
// so this module does not depend on the full inference DTO.
export interface ViewerResultModelIdentity {
  // /model/proxy/available returns the model-info id here, not the Firestore id.
  modelId?: string | null;
  containerId?: string | null;
  modelName: string;
  version?: string | null;
}

export interface SelectedViewBadge {
  number: number;
  viewLabel: string | null;
}

export interface PendingViewerModelRun {
  key: string;
  studyInstanceUID: string;
  modelId: string | null;
  containerId: string | null;
  modelName: string;
  modelVersion: string | null;
  // null when the run was already active (409) and its ids are unknown.
  runId: string | null;
  executionId: string | null;
  requestedAt: number;
  // The newest result known for the model when the run was requested, used
  // to recognize the run's result when the backend omits run identifiers.
  baselineCompletedAt: string | null;
  // Series the run was requested with; null when none were picked.
  seriesInstanceUIDs?: string[] | null;
}

// How a run requested from the viewer ended, kept briefly for the running-jobs
// indicator. `foreground` is true when the user was waiting on the run in the
// series pop-up, which then reported the end itself.
export interface EndedViewerModelRun {
  run: PendingViewerModelRun;
  // 'cancelled': the user cancelled the run from the running-jobs indicator.
  outcome: 'completed' | PendingRunFailure;
  // Why a run that produced no result ended, when the backend says so.
  reason?: string | null;
  result: ViewerModelResult | null;
  endedAt: number;
  foreground: boolean;
}
