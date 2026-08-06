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

export const PROCESSING_RUN_TRIGGERS = ['AUTO', 'MANUAL_REPROCESS', 'LEGACY_IMPORT'] as const;

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
  candidateId: string | null;
  studyServiceJobId: string | null;
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
}

export interface StudyProcessingRunHistory {
  studyInstanceUID: string;
  runs: ProcessingRun[];
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
