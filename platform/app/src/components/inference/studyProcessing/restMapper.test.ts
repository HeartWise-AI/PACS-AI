import {
  mapStudyProcessingRunHistory,
  mapWorklistStudyStatus,
  mapWorklistStudyStatusEvent,
  mapWorklistStudyStatusPage,
} from './restMapper';
import type {
  ProcessingRunCountsDTO,
  ProcessingRunDetailDTO,
  WorklistStudyStatusDTO,
  WorklistStudyStatusEventDTO,
} from './restDTO';

const counts: ProcessingRunCountsDTO = {
  expectedModels: 0,
  pendingModels: 0,
  queuedModels: 0,
  runningModels: 0,
  completedModels: 0,
  failedModels: 0,
  skippedModels: 0,
  cancelledModels: 0,
  activeModels: 0,
};

function retrievalStatus(overrides: Partial<WorklistStudyStatusDTO> = {}): WorklistStudyStatusDTO {
  return {
    ...counts,
    studyInstanceUID: 'study-retrieval',
    ingestionStatus: 'RETRIEVAL_QUEUED',
    retrievalState: 'RUNNING',
    retrievalError: null,
    runId: null,
    runNumber: null,
    trigger: null,
    phase: null,
    outcome: null,
    attentionRequired: false,
    attentionReasons: [],
    version: null,
    startedAt: null,
    completedAt: null,
    updatedAt: '2026-08-06T14:00:00Z',
    ...overrides,
  };
}

function liveStatusEvent(
  overrides: Partial<WorklistStudyStatusEventDTO> = {}
): WorklistStudyStatusEventDTO {
  return {
    ...counts,
    type: 'study_status.updated',
    studyInstanceUID: 'study-live',
    runId: 'run-live-2',
    runNumber: 2,
    trigger: 'AUTO',
    phase: 'PROCESSING',
    outcome: null,
    attentionRequired: false,
    attentionReasons: [],
    version: 7,
    startedAt: '2026-08-07T14:00:00Z',
    completedAt: null,
    updatedAt: '2026-08-07T14:01:00Z',
    ...overrides,
  };
}

function legacyRun(): ProcessingRunDetailDTO {
  return {
    ...counts,
    expectedModels: 2,
    failedModels: 1,
    skippedModels: 1,
    runId: 'legacy-run-1',
    studyInstanceUID: 'legacy-study',
    runNumber: 1,
    trigger: 'LEGACY_IMPORT',
    phase: 'TERMINAL',
    outcome: 'NO_RESULT',
    attentionRequired: true,
    attentionReasons: [
      {
        code: 'MANUAL_REVIEW_REQUIRED',
        message: 'Legacy state needs operator review.',
      },
    ],
    version: 1,
    startedAt: null,
    completedAt: null,
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2026-08-06T14:00:00Z',
    executions: [
      {
        executionId: 'legacy-failed',
        modelName: 'LegacyModel',
        modelVersion: null,
        modality: null,
        status: 'failed',
        errorMessage: 'Legacy execution failed.',
        skipReason: null,
        startedAt: null,
        completedAt: null,
        updatedAt: '2026-08-06T13:58:00Z',
      },
      {
        executionId: 'legacy-skipped',
        modelName: 'LegacySkippedModel',
        modelVersion: '1.0.0',
        modality: 'US',
        status: 'skipped',
        errorMessage: null,
        skipReason: {
          code: 'MODEL_NOT_APPLICABLE',
          message: null,
        },
        startedAt: null,
        completedAt: null,
        updatedAt: '2026-08-06T13:59:00Z',
      },
    ],
  };
}

describe('study processing REST mapper', () => {
  test('maps retrieval-only state without inventing a run version', () => {
    const summary = mapWorklistStudyStatus(retrievalStatus());

    expect(summary).toMatchObject({
      studyInstanceUID: 'study-retrieval',
      lifecycle: 'RETRIEVING',
      ingestionStatus: 'RETRIEVAL_QUEUED',
      retrievalState: 'RUNNING',
      runId: null,
      runNumber: null,
      trigger: null,
      phase: null,
      version: null,
      startedAt: null,
      completedAt: null,
    });
  });

  test('preserves run trigger and timestamps in the canonical summary', () => {
    const summary = mapWorklistStudyStatus(
      retrievalStatus({
        ingestionStatus: 'RETRIEVED',
        retrievalState: 'COMPLETED',
        runId: 'run-3',
        runNumber: 3,
        trigger: 'MANUAL_REPROCESS',
        phase: 'TERMINAL',
        outcome: 'SUCCESS',
        version: 4,
        startedAt: '2026-08-06T13:00:00Z',
        completedAt: '2026-08-06T13:01:00Z',
      })
    );

    expect(summary).toMatchObject({
      runId: 'run-3',
      runNumber: 3,
      trigger: 'MANUAL_REPROCESS',
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'SUCCESS',
      version: 4,
      startedAt: '2026-08-06T13:00:00Z',
      completedAt: '2026-08-06T13:01:00Z',
    });
  });

  test('maps a live run event into the same canonical summary used by REST', () => {
    const summary = mapWorklistStudyStatusEvent(
      liveStatusEvent({
        expectedModels: 3,
        runningModels: 1,
        completedModels: 2,
        activeModels: 1,
        attentionRequired: true,
        attentionReasons: [
          {
            code: 'FUTURE_LIVE_WARNING',
            message: 'A readable live warning.',
          },
        ],
      })
    );

    expect(summary).toMatchObject({
      studyInstanceUID: 'study-live',
      ingestionStatus: 'RETRIEVED',
      retrievalState: null,
      retrievalError: null,
      runId: 'run-live-2',
      runNumber: 2,
      trigger: 'AUTO',
      lifecycle: 'PROCESSING',
      phase: 'PROCESSING',
      expectedModels: 3,
      runningModels: 1,
      completedModels: 2,
      activeModels: 1,
      version: 7,
      attentionReasons: [
        {
          code: 'FUTURE_LIVE_WARNING',
          message: 'A readable live warning.',
        },
      ],
    });
    expect(summary).not.toHaveProperty('type');
  });

  test('preserves retrieval errors and maps waiting lifecycle states', () => {
    const summary = mapWorklistStudyStatus(
      retrievalStatus({
        ingestionStatus: 'FAILED',
        retrievalState: 'error',
        retrievalError: 'Orthanc retrieval failed.',
      })
    );

    expect(summary.lifecycle).toBe('WAITING');
    expect(summary.retrievalError).toBe('Orthanc retrieval failed.');
  });

  test('maps only the studies contained in the backend page', () => {
    const page = mapWorklistStudyStatusPage({
      studies: [retrievalStatus({ studyInstanceUID: 'visible-a' })],
      limit: 25,
      offset: 0,
      hasMore: true,
    });

    expect(page.summaries.map(summary => summary.studyInstanceUID)).toEqual(['visible-a']);
    expect(page).toMatchObject({ limit: 25, offset: 0, hasMore: true });
  });

  test('preserves unknown structured attention reasons', () => {
    const summary = mapWorklistStudyStatus(
      retrievalStatus({
        attentionRequired: true,
        attentionReasons: [
          {
            code: 'FUTURE_BACKEND_REASON',
            message: 'A future operator-facing warning.',
          },
        ],
      })
    );

    expect(summary.attentionReasons).toEqual([
      {
        code: 'FUTURE_BACKEND_REASON',
        message: 'A future operator-facing warning.',
      },
    ]);
  });

  test('preserves every backend model count in the canonical summary', () => {
    const summary = mapWorklistStudyStatus(
      retrievalStatus({
        expectedModels: 9,
        pendingModels: 1,
        queuedModels: 2,
        runningModels: 3,
        completedModels: 1,
        failedModels: 1,
        skippedModels: 0,
        cancelledModels: 1,
        activeModels: 6,
      })
    );

    expect(summary).toMatchObject({
      expectedModels: 9,
      pendingModels: 1,
      queuedModels: 2,
      runningModels: 3,
      completedModels: 1,
      failedModels: 1,
      skippedModels: 0,
      cancelledModels: 1,
      activeModels: 6,
    });
  });

  test('maps available legacy executions without fabricating private identifiers', () => {
    const page = mapStudyProcessingRunHistory('legacy-study', {
      runs: [legacyRun()],
      limit: 25,
      offset: 0,
      hasMore: false,
    });
    const { history } = page;

    expect(page).toMatchObject({ limit: 25, offset: 0, hasMore: false });
    expect(history.runs).toHaveLength(1);
    expect(history.runs[0].trigger).toBe('LEGACY_IMPORT');
    expect(history.runs[0].attentionReasons[0]).toEqual({
      code: 'MANUAL_REVIEW_REQUIRED',
      message: 'Legacy state needs operator review.',
    });
    expect(history.runs[0].modelExecutions[0]).toMatchObject({
      id: 'legacy-failed',
      candidateId: null,
      studyServiceJobId: null,
      modelVersion: null,
      modality: null,
      queuedAt: null,
      error: {
        code: null,
        message: 'Legacy execution failed.',
      },
    });
    expect(history.runs[0].modelExecutions[1].skipReason).toEqual({
      code: 'MODEL_NOT_APPLICABLE',
      message: null,
    });
  });

  test('preserves an unknown future structured skip reason', () => {
    const run = legacyRun();
    run.executions[1].skipReason = {
      code: 'FUTURE_BACKEND_SKIP_REASON',
      message: 'A future operator-facing skip explanation.',
    };

    const page = mapStudyProcessingRunHistory('legacy-study', {
      runs: [run],
      limit: 25,
      offset: 0,
      hasMore: false,
    });

    expect(page.history.runs[0].modelExecutions[1].skipReason).toEqual({
      code: 'FUTURE_BACKEND_SKIP_REASON',
      message: 'A future operator-facing skip explanation.',
    });
  });
});
