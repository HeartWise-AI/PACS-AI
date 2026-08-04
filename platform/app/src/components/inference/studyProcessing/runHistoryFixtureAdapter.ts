import { modelExecutionFixtures, studyProcessingRunHistoryFixture } from './fixtures';
import type {
  ModelExecution,
  ModelExecutionStatus,
  ProcessingRun,
  StudyProcessingRunHistory,
  StudyProcessingSummary,
} from './types';

const executionTemplates = Object.values(modelExecutionFixtures);

function executionStatusesForSummary(summary: StudyProcessingSummary): ModelExecutionStatus[] {
  return [
    ...Array(summary.completedModels).fill('completed'),
    ...Array(summary.failedModels).fill('failed'),
    ...Array(summary.skippedModels).fill('skipped'),
    ...Array(summary.cancelledModels).fill('cancelled'),
    ...Array(summary.activeModels).fill('running'),
  ].slice(0, summary.expectedModels) as ModelExecutionStatus[];
}

function modelExecutionsForSummary(summary: StudyProcessingSummary): ModelExecution[] {
  const statuses = executionStatusesForSummary(summary);

  while (statuses.length < summary.expectedModels) {
    statuses.push(summary.lifecycle === 'QUEUED' ? 'queued' : 'pending');
  }

  return statuses.map((status, index) => {
    const template = executionTemplates[index % executionTemplates.length];
    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';
    const isSkipped = status === 'skipped';
    const isCancelled = status === 'cancelled';
    const hasStarted = isCompleted || isFailed || status === 'running';

    return {
      ...template,
      id: `${summary.runId || 'run'}-execution-${index + 1}`,
      status,
      error: isFailed ? modelExecutionFixtures.failed.error : null,
      skipReason: isSkipped ? modelExecutionFixtures.skipped.skipReason : null,
      queuedAt: isSkipped ? null : summary.updatedAt,
      startedAt: hasStarted ? summary.updatedAt : null,
      completedAt: isCompleted || isFailed || isSkipped || isCancelled ? summary.updatedAt : null,
      updatedAt: summary.updatedAt,
    };
  });
}

export function createStudyProcessingRunHistoryFixture(
  summary: StudyProcessingSummary
): StudyProcessingRunHistory {
  if (!summary.runId || !summary.runNumber || !summary.phase) {
    return {
      studyInstanceUID: summary.studyInstanceUID,
      runs: [],
    };
  }

  const baseRun = studyProcessingRunHistoryFixture.runs[0];
  const currentRun: ProcessingRun = {
    ...baseRun,
    id: summary.runId,
    studyInstanceUID: summary.studyInstanceUID,
    runNumber: summary.runNumber,
    phase: summary.phase,
    outcome: summary.outcome,
    attentionRequired: summary.attentionRequired,
    attentionReasons: summary.attentionReasons,
    expectedModels: summary.expectedModels,
    completedModels: summary.completedModels,
    failedModels: summary.failedModels,
    skippedModels: summary.skippedModels,
    cancelledModels: summary.cancelledModels,
    activeModels: summary.activeModels,
    version: summary.version,
    completedAt: summary.lifecycle === 'TERMINAL' ? summary.updatedAt : null,
    updatedAt: summary.updatedAt,
    modelExecutions: modelExecutionsForSummary(summary),
  };

  const olderRuns = studyProcessingRunHistoryFixture.runs
    .filter(run => run.runNumber < summary.runNumber!)
    .map(run => ({
      ...run,
      studyInstanceUID: summary.studyInstanceUID,
      modelExecutions: run.modelExecutions.map(execution => ({ ...execution })),
    }));

  return {
    studyInstanceUID: summary.studyInstanceUID,
    runs: [currentRun, ...olderRuns].sort((left, right) => right.runNumber - left.runNumber),
  };
}
