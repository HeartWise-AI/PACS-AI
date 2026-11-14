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
}
