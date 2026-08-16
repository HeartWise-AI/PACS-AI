import type { ModelExecutionResultSelection } from './executionResultQuery';
import type { ModelExecution, ProcessingRun } from './types';

export function createModelExecutionResultSelection(
  run: ProcessingRun,
  execution: ModelExecution
): ModelExecutionResultSelection | null {
  const studyInstanceUID = run.studyInstanceUID.trim();
  const runId = run.id.trim();
  const executionId = execution.id.trim();
  const modelName = execution.modelName.trim();

  if (
    execution.status !== 'completed' ||
    !studyInstanceUID ||
    !runId ||
    !executionId ||
    !modelName
  ) {
    return null;
  }

  return {
    studyInstanceUID,
    runId,
    executionId,
    modelName,
    modelVersion: execution.modelVersion?.trim() || null,
    status: execution.status,
  };
}
