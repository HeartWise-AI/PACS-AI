// Types of the AI Predictions page (GET /v1/inference/predictions).

export type PredictionsView = 'mine' | 'automatic' | 'all';

export type PredictionState =
  | 'waiting'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type PredictionTrigger = 'AUTO' | 'MANUAL_REPROCESS' | 'LEGACY_IMPORT' | 'VIEWER_REQUEST';

export interface PredictionSkipReason {
  code: string;
  message: string | null;
}

export interface PredictionExecution {
  runId: string;
  executionId: string;
  runNumber: number;
  trigger: PredictionTrigger | string;
  requestedByUserId: string | null;
  requestedByName: string | null;
  requestedByYou: boolean;
  modelName: string;
  modelVersion: string | null;
  modality: string | null;
  state: PredictionState;
  status: string;
  errorMessage: string | null;
  skipReason: PredictionSkipReason | null;
  cancellable: boolean;
  cancelledAt: string | null;
  runCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface PredictionModel extends PredictionExecution {
  earlierRuns: number;
}

export interface PredictionCounts {
  total: number;
  waiting: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  skipped: number;
  cancelled: number;
}

export interface PredictionLauncher {
  kind: 'automatic' | 'user';
  trigger: PredictionTrigger | string;
  userId: string | null;
  name: string | null;
  you: boolean;
  runs: number;
  firstAt: string;
}

export interface PredictionExam {
  studyInstanceUID: string;
  patientId: string | null;
  accessionNumber: string | null;
  modalitiesInStudy: string | null;
  studyDate: string | null;
  lastActivityAt: string;
  active: boolean;
  counts: PredictionCounts;
  models: PredictionModel[];
  launchers: PredictionLauncher[];
}

export interface PredictionsPage {
  view: PredictionsView;
  exams: PredictionExam[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  canViewAll: boolean;
}

export interface PredictionHistoryPage {
  studyInstanceUID: string;
  modelName: string;
  executions: PredictionExecution[];
  hasMore: boolean;
}

export type PredictionsStatusFilter = 'any' | 'active' | 'attention' | 'completed';
export type PredictionsDateFilter = 'today' | '7d' | '30d' | 'any' | 'custom';

export interface PredictionsFilters {
  view: PredictionsView;
  search: string;
  model: string;
  status: PredictionsStatusFilter;
  modality: string;
  date: PredictionsDateFilter;
  // yyyy-mm-dd in the viewer's time zone, inclusive.
  customFrom: string;
  customTo: string;
  // 'any', 'automatic', 'people' or 'user:<id>'; used in the "all" view only.
  launchedBy: string;
  page: number;
}

/** What the page shows for an exam that the local PACS describes. */
export interface PredictionStudyLabels {
  patientName: string | null;
  patientId: string | null;
  accessionNumber: string | null;
  modalitiesInStudy: string | null;
  studyDescription: string | null;
}
