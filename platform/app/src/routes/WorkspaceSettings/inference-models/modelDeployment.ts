import type {
  DeployInferenceModelVersionResponse,
  InferenceModelDeploymentEvent,
  InferenceModelDeploymentOperation,
  InferenceModelDeploymentStage,
  InferenceModelDeploymentStatus,
} from '../../../api/inferenceDTO';

export const MODEL_DEPLOYMENT_TERMINAL_STATUSES: InferenceModelDeploymentStatus[] = [
  'COMPLETED',
  'FAILED',
  'ROLLED_BACK',
  'INTERRUPTED',
];

export type ModelDeploymentConnectionMode = 'connecting' | 'live' | 'polling';

export interface TrackedModelDeployment {
  modelId: string;
  progress: InferenceModelDeploymentEvent;
  connectionMode: ModelDeploymentConnectionMode;
}

export function isTerminalModelDeploymentStatus(status: InferenceModelDeploymentStatus): boolean {
  return MODEL_DEPLOYMENT_TERMINAL_STATUSES.includes(status);
}

export function isActiveModelDeployment(deployment?: TrackedModelDeployment): boolean {
  return Boolean(deployment && !deployment.progress.terminal);
}

export function acceptedDeploymentProgress(
  response: DeployInferenceModelVersionResponse,
  timestamp = Date.now()
): InferenceModelDeploymentEvent {
  return {
    deploymentId: response.deploymentId,
    status: response.status,
    stage: response.stage,
    sequence: 0,
    timestamp,
    elapsedMilliseconds: 0,
    terminal: isTerminalModelDeploymentStatus(response.status),
  };
}

export function operationDeploymentProgress(
  operation: InferenceModelDeploymentOperation
): InferenceModelDeploymentEvent {
  const start = operation.startedAt || operation.createdAt;
  const end = operation.finishedAt || operation.updatedAt;
  return {
    deploymentId: operation.id,
    status: operation.status,
    stage: operation.stage,
    sequence: operation.sequence,
    timestamp: operation.updatedAt,
    elapsedMilliseconds: Math.max(0, end - start),
    terminal: isTerminalModelDeploymentStatus(operation.status),
    errorCode: operation.errorCode,
    errorMessage: operation.errorMessage,
    rollbackError: operation.rollbackError,
  };
}

export const MODEL_DEPLOYMENT_STAGE_LABELS: Record<InferenceModelDeploymentStage, string> = {
  resolve_active: 'Resolving active deployment',
  resolve_version: 'Resolving selected version',
  pull: 'Pulling image',
  create_candidate: 'Creating candidate',
  validate_candidate: 'Validating candidate',
  drain_active: 'Draining active inference',
  prepare_candidate: 'Preparing candidate',
  activate_candidate: 'Activating candidate',
};

export const MODEL_DEPLOYMENT_STATUS_LABELS: Record<InferenceModelDeploymentStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  ROLLED_BACK: 'Rolled back',
  INTERRUPTED: 'Interrupted',
};

export function formatDeploymentElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : `${seconds}s`;
}
