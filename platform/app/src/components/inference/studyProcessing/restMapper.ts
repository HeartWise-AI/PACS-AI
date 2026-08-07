import type {
  ModelExecution,
  ProcessingAttentionReason,
  ProcessingRun,
  StudyProcessingLifecycle,
  StudyProcessingRunHistory,
  StudyProcessingSummary,
} from './types';
import type {
  ProcessingAttentionReasonDTO,
  ProcessingRunDetailDTO,
  ProcessingRunExecutionDTO,
  StudyProcessingRunHistoryPageDTO,
  WorklistStudyStatusDTO,
  WorklistStudyStatusEventDTO,
  WorklistStudyStatusPageDTO,
} from './restDTO';

function mapAttentionReason(reason: ProcessingAttentionReasonDTO): ProcessingAttentionReason {
  return {
    code: reason.code,
    message: reason.message ?? null,
  };
}

function mapLifecycle(status: WorklistStudyStatusDTO): StudyProcessingLifecycle {
  if (status.phase) {
    return status.phase;
  }

  const retrievalState = status.retrievalState?.trim().toUpperCase();
  if (
    status.ingestionStatus === 'RETRIEVAL_QUEUED' ||
    retrievalState === 'PENDING' ||
    retrievalState === 'QUEUED' ||
    retrievalState === 'RUNNING'
  ) {
    return 'RETRIEVING';
  }

  return 'WAITING';
}

export function mapWorklistStudyStatus(status: WorklistStudyStatusDTO): StudyProcessingSummary {
  return {
    studyInstanceUID: status.studyInstanceUID,
    ingestionStatus: status.ingestionStatus,
    retrievalState: status.retrievalState,
    retrievalError: status.retrievalError,
    runId: status.runId,
    runNumber: status.runNumber,
    trigger: status.trigger,
    lifecycle: mapLifecycle(status),
    phase: status.phase,
    outcome: status.outcome,
    attentionRequired: status.attentionRequired,
    attentionReasons: status.attentionReasons.map(mapAttentionReason),
    expectedModels: status.expectedModels,
    pendingModels: status.pendingModels,
    queuedModels: status.queuedModels,
    runningModels: status.runningModels,
    completedModels: status.completedModels,
    failedModels: status.failedModels,
    skippedModels: status.skippedModels,
    cancelledModels: status.cancelledModels,
    activeModels: status.activeModels,
    version: status.version,
    startedAt: status.startedAt,
    completedAt: status.completedAt,
    updatedAt: status.updatedAt,
  };
}

export function mapWorklistStudyStatusEvent(
  event: WorklistStudyStatusEventDTO
): StudyProcessingSummary {
  const eventStatus = {
    ...event,
    ingestionStatus: 'RETRIEVED' as const,
    retrievalState: null,
    retrievalError: null,
  };

  return mapWorklistStudyStatus(eventStatus);
}

export function mapWorklistStudyStatusPage(page: WorklistStudyStatusPageDTO): {
  summaries: StudyProcessingSummary[];
  limit: number;
  offset: number;
  hasMore: boolean;
} {
  return {
    summaries: page.studies.map(mapWorklistStudyStatus),
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
  };
}

function mapProcessingRunExecution(execution: ProcessingRunExecutionDTO): ModelExecution {
  return {
    id: execution.executionId,
    candidateId: null,
    studyServiceJobId: null,
    modelName: execution.modelName,
    modelVersion: execution.modelVersion,
    modality: execution.modality,
    status: execution.status,
    skipReason: execution.skipReason
      ? {
          code: execution.skipReason.code,
          message: execution.skipReason.message ?? null,
        }
      : null,
    error: execution.errorMessage
      ? {
          code: null,
          message: execution.errorMessage,
        }
      : null,
    queuedAt: null,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    updatedAt: execution.updatedAt,
  };
}

export function mapProcessingRun(run: ProcessingRunDetailDTO): ProcessingRun {
  return {
    id: run.runId,
    studyInstanceUID: run.studyInstanceUID,
    runNumber: run.runNumber,
    trigger: run.trigger,
    phase: run.phase,
    outcome: run.outcome,
    attentionRequired: run.attentionRequired,
    attentionReasons: run.attentionReasons.map(mapAttentionReason),
    expectedModels: run.expectedModels,
    pendingModels: run.pendingModels,
    queuedModels: run.queuedModels,
    runningModels: run.runningModels,
    completedModels: run.completedModels,
    failedModels: run.failedModels,
    skippedModels: run.skippedModels,
    cancelledModels: run.cancelledModels,
    activeModels: run.activeModels,
    version: run.version,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    modelExecutions: run.executions.map(mapProcessingRunExecution),
  };
}

export function mapStudyProcessingRunHistory(
  studyInstanceUID: string,
  page: StudyProcessingRunHistoryPageDTO
): {
  history: StudyProcessingRunHistory;
  limit: number;
  offset: number;
  hasMore: boolean;
} {
  return {
    history: {
      studyInstanceUID,
      runs: page.runs.map(mapProcessingRun),
    },
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
  };
}
