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
  modelId: string | null;
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
}

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
  modelId?: string | null;
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
  modelId: string;
  modelName: string;
  modelVersion: string | null;
  runId: string;
  executionId: string | null;
  requestedAt: number;
  // The newest result known for the model when the run was requested, used
  // to recognize the run's result when the backend omits run identifiers.
  baselineCompletedAt: string | null;
}
