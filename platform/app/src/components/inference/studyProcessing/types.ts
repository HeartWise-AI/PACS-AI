export const STUDY_PROCESSING_LIFECYCLES = [
  'WAITING',
  'RETRIEVING',
  'QUEUED',
  'PROCESSING',
  'TERMINAL',
] as const;

export type StudyProcessingLifecycle = (typeof STUDY_PROCESSING_LIFECYCLES)[number];

export const PROCESSING_RUN_PHASES = ['QUEUED', 'PROCESSING', 'TERMINAL'] as const;

export type ProcessingRunPhase = (typeof PROCESSING_RUN_PHASES)[number];

export const PROCESSING_RUN_OUTCOMES = [
  'SUCCESS',
  'SUCCESS_WITH_SKIPS',
  'PARTIAL_SUCCESS',
  'NO_RESULT',
  'FAILED',
  'CANCELLED',
] as const;

export type ProcessingRunOutcome = (typeof PROCESSING_RUN_OUTCOMES)[number];

export const PROCESSING_RUN_TRIGGERS = [
  'AUTO',
  'MANUAL_REPROCESS',
  'LEGACY_IMPORT',
  'VIEWER_REQUEST',
] as const;

export type ProcessingRunTrigger = (typeof PROCESSING_RUN_TRIGGERS)[number];

export const MODEL_EXECUTION_STATUSES = [
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'skipped',
  'cancelled',
] as const;

export type ModelExecutionStatus = (typeof MODEL_EXECUTION_STATUSES)[number];

export const PROCESSING_ATTENTION_REASONS = [
  'DISPATCH_FAILED',
  'EXPECTED_JOB_MISSING',
  'PENDING_STALE',
  'QUEUE_STALE',
  'PROCESSING_STALE',
  'CALLBACK_DEAD_LETTERED',
  'STUDY_SERVICE_JOB_MISSING',
  'STATE_CONFLICT',
  'RECONCILIATION_FAILED',
  'EMPTY_MODEL_PLAN',
] as const;

export type KnownProcessingAttentionReasonCode = (typeof PROCESSING_ATTENTION_REASONS)[number];

export interface ProcessingAttentionReason {
  code: string;
  message: string | null;
}

export const INGESTION_STATUSES = [
  'DISCOVERED',
  'GROWING',
  'STABLE',
  'RETRIEVAL_QUEUED',
  'RETRIEVED',
  'DISAPPEARED',
  'FAILED',
] as const;

export type IngestionStatus = (typeof INGESTION_STATUSES)[number];

export const MODEL_SKIP_REASONS = [
  'NO_USABLE_DICOM',
  'UNSUPPORTED_MODALITY',
  'REQUIRED_SERIES_MISSING',
  'MODEL_NOT_APPLICABLE',
  'PREREQUISITE_NOT_MET',
  'MODEL_DISABLED',
] as const;

export type ModelSkipReasonCode = (typeof MODEL_SKIP_REASONS)[number];

export interface ProcessingModelCounts {
  expectedModels: number;
  pendingModels: number;
  queuedModels: number;
  runningModels: number;
  completedModels: number;
  failedModels: number;
  skippedModels: number;
  cancelledModels: number;
  activeModels: number;
}

export interface StudyProcessingSummary extends ProcessingModelCounts {
  studyInstanceUID: string;
  ingestionStatus: IngestionStatus;
  retrievalState: string | null;
  retrievalError: string | null;
  runId: string | null;
  runNumber: number | null;
  trigger: ProcessingRunTrigger | null;
  lifecycle: StudyProcessingLifecycle;
  phase: ProcessingRunPhase | null;
  outcome: ProcessingRunOutcome | null;
  attentionRequired: boolean;
  attentionReasons: ProcessingAttentionReason[];
  version: number | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface ModelSkipReason {
  code: string;
  message: string | null;
}

export interface ModelExecutionError {
  code: string | null;
  message: string;
}

export interface ModelExecution {
  id: string;
  modelName: string;
  modelVersion: string | null;
  modality: string | null;
  status: ModelExecutionStatus;
  skipReason: ModelSkipReason | null;
  error: ModelExecutionError | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

// ModelExecutionResult is the model-agnostic public result envelope. The
// payload remains unknown until a renderer explicitly recognizes its shape.
export interface ModelExecutionResult {
  runId: string;
  executionId: string;
  studyInstanceUID: string;
  modelName: string;
  modelVersion: string | null;
  status: 'completed';
  completedAt: string;
  result: unknown;
}

export type ModelExecutionResultFailureKind =
  | 'not_available'
  | 'invalid_result'
  | 'not_found'
  | 'forbidden'
  | 'service_unavailable'
  | 'unknown';

// ModelExecutionResultFailure contains only operator-safe normalized state;
// backend or upstream response bodies must never be retained here.
export interface ModelExecutionResultFailure {
  kind: ModelExecutionResultFailureKind;
  status: number | null;
  errorCode: string | null;
  retryable: boolean;
  message: string;
}

// Why an active run is not computing, as reported by the run detail.
export const PROCESSING_RUN_WAITING_REASONS = ['study_growing', 'stale'] as const;

export type ProcessingRunWaitingReason = (typeof PROCESSING_RUN_WAITING_REASONS)[number];

export interface ProcessingRun extends ProcessingModelCounts {
  id: string;
  studyInstanceUID: string;
  runNumber: number;
  trigger: ProcessingRunTrigger;
  phase: ProcessingRunPhase;
  outcome: ProcessingRunOutcome | null;
  attentionRequired: boolean;
  attentionReasons: ProcessingAttentionReason[];
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  modelExecutions: ModelExecution[];
  // The fields below are absent when the backend does not report them.
  // True while at least one model of the run can still be cancelled.
  cancellable?: boolean;
  // When a user cancelled the run's waiting models.
  cancelledAt?: string;
  waitingReason?: ProcessingRunWaitingReason;
  // With `study_growing`: when the study is stable if no more images arrive.
  stableAfter?: string;
}

export interface StudyProcessingRunHistory {
  studyInstanceUID: string;
  runs: ProcessingRun[];
}

export interface CreatedStudyProcessingRun {
  id: string;
  runNumber: number;
  trigger: ProcessingRunTrigger;
  phase: ProcessingRunPhase;
  expectedModels: number;
}

export interface PaginatedStudyProcessingSummaries {
  items: StudyProcessingSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
}

export type StudyStatusUpdatedEvent = Omit<StudyProcessingSummary, 'version'> & {
  type: 'study_status.updated';
  version: number;
};
