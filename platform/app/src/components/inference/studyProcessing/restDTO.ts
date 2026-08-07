import type {
  IngestionStatus,
  ModelExecutionStatus,
  ProcessingRunOutcome,
  ProcessingRunPhase,
  ProcessingRunTrigger,
} from './types';

export interface WorklistAPIResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface WorklistPageDTO {
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ProcessingRunCountsDTO {
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

export interface ProcessingAttentionReasonDTO {
  code: string;
  message?: string | null;
}

export interface WorklistStudyStatusDTO extends ProcessingRunCountsDTO {
  studyInstanceUID: string;
  ingestionStatus: IngestionStatus;
  retrievalState: string | null;
  retrievalError: string | null;
  runId: string | null;
  runNumber: number | null;
  trigger: ProcessingRunTrigger | null;
  phase: ProcessingRunPhase | null;
  outcome: ProcessingRunOutcome | null;
  attentionRequired: boolean;
  attentionReasons: ProcessingAttentionReasonDTO[];
  version: number | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface WorklistStudyStatusPageDTO extends WorklistPageDTO {
  studies: WorklistStudyStatusDTO[];
}

export interface WorklistStudyStatusEventDTO extends ProcessingRunCountsDTO {
  type: 'study_status.updated';
  studyInstanceUID: string;
  runId: string;
  runNumber: number;
  trigger: ProcessingRunTrigger;
  phase: ProcessingRunPhase;
  outcome: ProcessingRunOutcome | null;
  attentionRequired: boolean;
  attentionReasons: ProcessingAttentionReasonDTO[];
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface ProcessingRunSummaryDTO extends ProcessingRunCountsDTO {
  runId: string;
  studyInstanceUID: string;
  runNumber: number;
  trigger: ProcessingRunTrigger;
  phase: ProcessingRunPhase;
  outcome: ProcessingRunOutcome | null;
  attentionRequired: boolean;
  attentionReasons: ProcessingAttentionReasonDTO[];
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingRunExecutionDTO {
  executionId: string;
  modelName: string;
  modelVersion: string | null;
  modality: string | null;
  status: ModelExecutionStatus;
  errorMessage: string | null;
  skipReason: {
    code: string;
    message?: string | null;
  } | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface ProcessingRunDetailDTO extends ProcessingRunSummaryDTO {
  executions: ProcessingRunExecutionDTO[];
}

export interface StudyProcessingRunHistoryPageDTO extends WorklistPageDTO {
  runs: ProcessingRunDetailDTO[];
}

export interface CreateStudyProcessingRunResponseDTO {
  runId: string;
  runNumber: number;
  trigger: ProcessingRunTrigger;
  phase: ProcessingRunPhase;
  expectedModels: number;
}
