// Test-only helpers shared by the running-jobs tests.
import type { ProcessingRun } from '../studyProcessing/types';
import type { PendingViewerModelRun, ViewerModelResult } from '../viewerResults/types';
import type { RunningJobRow } from './types';

export const STUDY_UID = '1.2.3';

export function translate(
  strings: Record<string, string>,
  key: string,
  options: Record<string, unknown> = {}
): string {
  return (strings[key] ?? key).replace(/{{(\w+)}}/g, (_match, name) => String(options[name]));
}

export function pendingRun(overrides: Partial<PendingViewerModelRun> = {}): PendingViewerModelRun {
  return {
    key: 'container-1',
    studyInstanceUID: STUDY_UID,
    modelId: 'deepcoro',
    containerId: 'container-1',
    modelName: 'DeepCORO',
    modelVersion: '1.0.0',
    runId: 'run-1',
    executionId: 'execution-1',
    requestedAt: 1_000_000,
    baselineCompletedAt: null,
    ...overrides,
  };
}

export function viewerResult(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: STUDY_UID,
    modelName: 'DeepCORO',
    modelVersion: '1.0.0',
    modality: 'XA',
    modelId: 'model-1',
    artifactModelId: 'deepcoro',
    containerId: 'container-1',
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: 'job-1',
    completedAt: '2026-11-10T10:00:00Z',
    trigger: 'VIEWER_REQUEST',
    selectedViews: null,
    reportAvailable: true,
    ...overrides,
  };
}

export function processingRun(overrides: Partial<ProcessingRun> = {}): ProcessingRun {
  return {
    id: 'auto-run-1',
    studyInstanceUID: STUDY_UID,
    runNumber: 1,
    trigger: 'AUTO',
    phase: 'PROCESSING',
    outcome: null,
    attentionRequired: false,
    attentionReasons: [],
    version: 3,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:30Z',
    expectedModels: 7,
    pendingModels: 0,
    queuedModels: 3,
    runningModels: 2,
    completedModels: 1,
    failedModels: 0,
    skippedModels: 1,
    cancelledModels: 0,
    activeModels: 5,
    modelExecutions: [],
    ...overrides,
  };
}

export function jobRow(overrides: Partial<RunningJobRow> = {}): RunningJobRow {
  return {
    id: 'model:run-1',
    kind: 'model',
    modelName: 'DeepCORO',
    trigger: 'VIEWER_REQUEST',
    state: 'running',
    active: true,
    startedAt: 1_000_000,
    endedAt: null,
    progress: null,
    runningModelNames: [],
    result: null,
    ...overrides,
  };
}
