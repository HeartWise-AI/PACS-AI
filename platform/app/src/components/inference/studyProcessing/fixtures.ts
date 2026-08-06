import type {
  ModelExecution,
  PaginatedStudyProcessingSummaries,
  ProcessingRun,
  ProcessingRunOutcome,
  StudyProcessingLifecycle,
  StudyProcessingRunHistory,
  StudyProcessingSummary,
  StudyStatusUpdatedEvent,
} from './types';

const STUDY_UID_PREFIX = '1.2.840.113619.2.55.3.604688';
const UPDATED_AT = '2026-08-04T14:32:00Z';
const STUDY_UID_SUFFIXES: Record<StudyProcessingLifecycle, string> = {
  WAITING: '1',
  RETRIEVING: '2',
  QUEUED: '3',
  PROCESSING: '4',
  TERMINAL: '5',
};

const summary = (
  lifecycle: StudyProcessingLifecycle,
  outcome: ProcessingRunOutcome | null,
  overrides: Partial<StudyProcessingSummary> = {}
): StudyProcessingSummary => ({
  studyInstanceUID: `${STUDY_UID_PREFIX}.${STUDY_UID_SUFFIXES[lifecycle]}`,
  ingestionStatus:
    lifecycle === 'RETRIEVING'
      ? 'RETRIEVAL_QUEUED'
      : lifecycle === 'WAITING'
        ? 'STABLE'
        : 'RETRIEVED',
  retrievalState: lifecycle === 'RETRIEVING' ? 'RUNNING' : null,
  retrievalError: null,
  runId: lifecycle === 'WAITING' || lifecycle === 'RETRIEVING' ? null : `run-${lifecycle}`,
  runNumber: lifecycle === 'WAITING' || lifecycle === 'RETRIEVING' ? null : 1,
  lifecycle,
  phase:
    lifecycle === 'QUEUED' || lifecycle === 'PROCESSING' || lifecycle === 'TERMINAL'
      ? lifecycle
      : null,
  outcome,
  attentionRequired: false,
  attentionReasons: [],
  expectedModels: 0,
  pendingModels: 0,
  queuedModels: 0,
  runningModels: 0,
  completedModels: 0,
  failedModels: 0,
  skippedModels: 0,
  cancelledModels: 0,
  activeModels: 0,
  version: 1,
  updatedAt: UPDATED_AT,
  ...overrides,
});

export const studyProcessingSummaryFixtures = {
  waiting: summary('WAITING', null),
  retrieving: summary('RETRIEVING', null),
  queued: summary('QUEUED', null, {
    expectedModels: 3,
    queuedModels: 3,
    activeModels: 3,
  }),
  processing: summary('PROCESSING', null, {
    expectedModels: 3,
    runningModels: 2,
    completedModels: 1,
    activeModels: 2,
    version: 4,
  }),
  success: summary('TERMINAL', 'SUCCESS', {
    studyInstanceUID: `${STUDY_UID_PREFIX}.6`,
    runId: 'run-success',
    expectedModels: 3,
    completedModels: 3,
    version: 7,
  }),
  successWithSkips: summary('TERMINAL', 'SUCCESS_WITH_SKIPS', {
    studyInstanceUID: `${STUDY_UID_PREFIX}.7`,
    runId: 'run-success-with-skips',
    expectedModels: 3,
    completedModels: 2,
    skippedModels: 1,
    version: 7,
  }),
  partialSuccess: summary('TERMINAL', 'PARTIAL_SUCCESS', {
    studyInstanceUID: `${STUDY_UID_PREFIX}.8`,
    runId: 'run-partial-success',
    runNumber: 3,
    attentionRequired: true,
    attentionReasons: [{ code: 'RECONCILIATION_FAILED', message: null }],
    expectedModels: 3,
    completedModels: 2,
    failedModels: 1,
    version: 12,
  }),
  noResult: summary('TERMINAL', 'NO_RESULT', {
    studyInstanceUID: `${STUDY_UID_PREFIX}.9`,
    runId: 'run-no-result',
    expectedModels: 3,
    skippedModels: 3,
    version: 6,
  }),
  failed: summary('TERMINAL', 'FAILED', {
    studyInstanceUID: `${STUDY_UID_PREFIX}.10`,
    runId: 'run-failed',
    expectedModels: 3,
    failedModels: 3,
    version: 8,
  }),
  cancelled: summary('TERMINAL', 'CANCELLED', {
    studyInstanceUID: `${STUDY_UID_PREFIX}.11`,
    runId: 'run-cancelled',
    expectedModels: 3,
    cancelledModels: 3,
    version: 5,
  }),
} satisfies Record<string, StudyProcessingSummary>;

export const studyProcessingSnapshotFixture: PaginatedStudyProcessingSummaries = {
  items: Object.values(studyProcessingSummaryFixtures),
  page: 1,
  pageSize: 10,
  totalItems: 10,
};

export const studyStatusUpdatedEventFixture: StudyStatusUpdatedEvent = {
  ...studyProcessingSummaryFixtures.processing,
  type: 'study_status.updated',
  runningModels: 1,
  completedModels: 2,
  activeModels: 1,
  version: 5,
  updatedAt: '2026-08-04T14:33:00Z',
};

export const modelExecutionFixtures = {
  completed: {
    id: 'execution-panecho',
    candidateId: 'candidate-panecho',
    studyServiceJobId: 'job-panecho',
    modelName: 'PanEcho',
    modelVersion: '1.4.0',
    modality: 'US',
    status: 'completed',
    skipReason: null,
    error: null,
    queuedAt: '2026-08-04T14:30:00Z',
    startedAt: '2026-08-04T14:30:05Z',
    completedAt: '2026-08-04T14:31:10Z',
    updatedAt: '2026-08-04T14:31:10Z',
  },
  completedCathEf: {
    id: 'execution-cathef',
    candidateId: 'candidate-cathef',
    studyServiceJobId: 'job-cathef',
    modelName: 'CathEF-CLIP',
    modelVersion: '2.1.0',
    modality: 'US',
    status: 'completed',
    skipReason: null,
    error: null,
    queuedAt: '2026-08-04T14:30:00Z',
    startedAt: '2026-08-04T14:30:06Z',
    completedAt: '2026-08-04T14:31:42Z',
    updatedAt: '2026-08-04T14:31:42Z',
  },
  failed: {
    id: 'execution-deeprv',
    candidateId: 'candidate-deeprv',
    studyServiceJobId: 'job-deeprv',
    modelName: 'DeepRV-CLIP',
    modelVersion: '1.3.2',
    modality: 'US',
    status: 'failed',
    skipReason: null,
    error: {
      code: 'MODEL_EXECUTION_FAILED',
      message: 'Model execution failed before producing a result.',
    },
    queuedAt: '2026-08-04T14:30:00Z',
    startedAt: '2026-08-04T14:30:07Z',
    completedAt: '2026-08-04T14:32:00Z',
    updatedAt: '2026-08-04T14:32:00Z',
  },
  skipped: {
    id: 'execution-skipped',
    candidateId: 'candidate-skipped',
    studyServiceJobId: null,
    modelName: 'DeepCORO-CLIP',
    modelVersion: '1.0.0',
    modality: 'US',
    status: 'skipped',
    skipReason: {
      code: 'MODEL_NOT_APPLICABLE',
      message: 'The model is not applicable to this study.',
    },
    error: null,
    queuedAt: null,
    startedAt: null,
    completedAt: '2026-08-04T14:30:01Z',
    updatedAt: '2026-08-04T14:30:01Z',
  },
  cancelled: {
    id: 'execution-cancelled',
    candidateId: 'candidate-cancelled',
    studyServiceJobId: 'job-cancelled',
    modelName: 'EchoPrime',
    modelVersion: '1.2.0',
    modality: 'US',
    status: 'cancelled',
    skipReason: null,
    error: null,
    queuedAt: '2026-08-04T14:30:00Z',
    startedAt: null,
    completedAt: '2026-08-04T14:30:30Z',
    updatedAt: '2026-08-04T14:30:30Z',
  },
} satisfies Record<string, ModelExecution>;

const partialRun: ProcessingRun = {
  id: 'run-partial-success',
  studyInstanceUID: studyProcessingSummaryFixtures.partialSuccess.studyInstanceUID,
  runNumber: 3,
  trigger: 'MANUAL_REPROCESS',
  phase: 'TERMINAL',
  outcome: 'PARTIAL_SUCCESS',
  attentionRequired: true,
  attentionReasons: [{ code: 'RECONCILIATION_FAILED', message: null }],
  expectedModels: 3,
  pendingModels: 0,
  queuedModels: 0,
  runningModels: 0,
  completedModels: 2,
  failedModels: 1,
  skippedModels: 0,
  cancelledModels: 0,
  activeModels: 0,
  version: 12,
  startedAt: '2026-08-04T14:30:00Z',
  completedAt: '2026-08-04T14:32:00Z',
  createdAt: '2026-08-04T14:29:58Z',
  updatedAt: '2026-08-04T14:32:00Z',
  modelExecutions: [
    modelExecutionFixtures.completed,
    modelExecutionFixtures.completedCathEf,
    modelExecutionFixtures.failed,
  ],
};

export const studyProcessingRunHistoryFixture: StudyProcessingRunHistory = {
  studyInstanceUID: studyProcessingSummaryFixtures.partialSuccess.studyInstanceUID,
  runs: [
    partialRun,
    {
      ...partialRun,
      id: 'run-success-2',
      runNumber: 2,
      trigger: 'AUTO',
      outcome: 'SUCCESS',
      attentionRequired: false,
      attentionReasons: [],
      completedModels: 3,
      failedModels: 0,
      version: 8,
      modelExecutions: partialRun.modelExecutions.map(execution => ({
        ...execution,
        status: 'completed',
        error: null,
      })),
    },
    {
      ...partialRun,
      id: 'run-legacy-1',
      runNumber: 1,
      trigger: 'LEGACY_IMPORT',
      outcome: 'SUCCESS',
      attentionRequired: false,
      attentionReasons: [],
      completedModels: 3,
      failedModels: 0,
      version: 1,
      modelExecutions: [],
    },
  ],
};
