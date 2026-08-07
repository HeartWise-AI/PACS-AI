import type {
  ProcessingRunCountsDTO,
  ProcessingRunDetailDTO,
  StudyProcessingRunHistoryPageDTO,
  WorklistStudyStatusDTO,
  WorklistStudyStatusEventDTO,
  WorklistStudyStatusPageDTO,
} from './restDTO';
import {
  createStudyProcessingRESTRepository,
  type StudyProcessingHTTPClient,
} from './restRepository';
import {
  initialStudyProcessingState,
  studyProcessingReducer,
  type StudyProcessingState,
} from './reducer';
import { createRESTRunHistoryTransport } from './runHistoryTransport';
import { createRESTStudyProcessingSnapshotTransport } from './snapshotTransport';
import { WORKLIST_STUDY_STATUS_EVENT } from './sseParser';
import { streamStudyProcessingEvents, type StudyProcessingSSEResponse } from './sseTransport';

const retrievalStudyUID = '1.2.840.retrieval';
const processingStudyUID = '1.2.840.processing';

const emptyCounts: ProcessingRunCountsDTO = {
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

function retrievalOnlyStatus(updatedAt: string): WorklistStudyStatusDTO {
  return {
    ...emptyCounts,
    studyInstanceUID: retrievalStudyUID,
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
    updatedAt,
  };
}

function runStatus(overrides: Partial<WorklistStudyStatusDTO> = {}): WorklistStudyStatusDTO {
  return {
    ...emptyCounts,
    studyInstanceUID: processingStudyUID,
    ingestionStatus: 'RETRIEVED',
    retrievalState: 'COMPLETED',
    retrievalError: null,
    runId: 'run-3',
    runNumber: 3,
    trigger: 'AUTO',
    phase: 'PROCESSING',
    outcome: null,
    attentionRequired: false,
    attentionReasons: [],
    expectedModels: 3,
    completedModels: 1,
    runningModels: 2,
    activeModels: 2,
    version: 4,
    startedAt: '2026-08-07T14:00:00Z',
    completedAt: null,
    updatedAt: '2026-08-07T14:01:00Z',
    ...overrides,
  };
}

function liveEvent(
  overrides: Partial<WorklistStudyStatusEventDTO> = {}
): WorklistStudyStatusEventDTO {
  const status = runStatus();
  return {
    type: WORKLIST_STUDY_STATUS_EVENT,
    studyInstanceUID: status.studyInstanceUID,
    runId: status.runId!,
    runNumber: status.runNumber!,
    trigger: status.trigger!,
    phase: status.phase!,
    outcome: status.outcome,
    attentionRequired: status.attentionRequired,
    attentionReasons: status.attentionReasons,
    expectedModels: status.expectedModels,
    pendingModels: status.pendingModels,
    queuedModels: status.queuedModels,
    runningModels: status.runningModels,
    completedModels: status.completedModels,
    failedModels: status.failedModels,
    skippedModels: status.skippedModels,
    cancelledModels: status.cancelledModels,
    activeModels: status.activeModels,
    version: status.version!,
    startedAt: status.startedAt,
    completedAt: status.completedAt,
    updatedAt: status.updatedAt,
    ...overrides,
  };
}

function legacyRun(): ProcessingRunDetailDTO {
  return {
    ...emptyCounts,
    runId: 'legacy-run-1',
    studyInstanceUID: processingStudyUID,
    runNumber: 1,
    trigger: 'LEGACY_IMPORT',
    phase: 'TERMINAL',
    outcome: 'SUCCESS_WITH_SKIPS',
    attentionRequired: true,
    attentionReasons: [{ code: 'LEGACY_HISTORY_INCOMPLETE' }],
    expectedModels: 2,
    completedModels: 1,
    skippedModels: 1,
    version: 1,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
    executions: [
      {
        executionId: 'legacy-execution-1',
        modelName: 'LegacyModel',
        modelVersion: null,
        modality: null,
        status: 'skipped',
        errorMessage: null,
        skipReason: { code: 'MODEL_NOT_APPLICABLE' },
        startedAt: null,
        completedAt: null,
        updatedAt: '2026-08-01T12:00:00Z',
      },
    ],
  };
}

function statusPage(studies: WorklistStudyStatusDTO[]): WorklistStudyStatusPageDTO {
  return { studies, limit: 2, offset: 0, hasMore: false };
}

function historyPage(): StudyProcessingRunHistoryPageDTO {
  return { runs: [legacyRun()], limit: 25, offset: 0, hasMore: false };
}

function apiResponse<T>(data: T) {
  return { data: { success: true, message: 'ok', data } };
}

function createMockBackend(statusPages: WorklistStudyStatusPageDTO[]) {
  let statusRequest = 0;
  const get = jest.fn(async (path: string) => {
    if (path === '/v1/inference/worklist/status') {
      const page = statusPages[Math.min(statusRequest, statusPages.length - 1)];
      statusRequest += 1;
      return apiResponse(page);
    }

    if (path.includes('/runs')) {
      return apiResponse(historyPage());
    }

    throw new Error(`Unexpected mock backend path: ${path}`);
  });

  return {
    get,
    client: {
      get,
      post: jest.fn(),
    } as unknown as StudyProcessingHTTPClient,
  };
}

function encode(text: string): Uint8Array {
  return Uint8Array.from([...text].map(character => character.charCodeAt(0)));
}

async function streamEvents(
  events: WorklistStudyStatusEventDTO[],
  onEvent: Parameters<typeof streamStudyProcessingEvents>[0]['onEvent']
): Promise<void> {
  const eventStream = [
    ': heartbeat',
    '',
    ...events.flatMap(event => [
      `event: ${WORKLIST_STUDY_STATUS_EVENT}`,
      `data: ${JSON.stringify(event)}`,
      '',
    ]),
  ].join('\n');
  let delivered = false;
  const response: StudyProcessingSSEResponse = {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream; charset=utf-8' },
    body: {
      getReader: () => ({
        read: async () => {
          if (delivered) {
            return { done: true };
          }
          delivered = true;
          return { done: false, value: encode(eventStream) };
        },
        releaseLock: jest.fn(),
      }),
    },
  };

  await streamStudyProcessingEvents({
    getAuthorizationHeader: () => ({ Authorization: 'Bearer contract-test-token' }),
    fetchImplementation: jest.fn().mockResolvedValue(response),
    createTextDecoder: () => ({
      decode: input => (input ? String.fromCharCode(...Array.from(input)) : ''),
    }),
    onEvent,
  });
}

function receiveSnapshot(
  state: StudyProcessingState,
  summaries: Awaited<
    ReturnType<
      ReturnType<typeof createRESTStudyProcessingSnapshotTransport>['loadVisibleStudySnapshot']
    >
  >
) {
  return studyProcessingReducer(state, { type: 'snapshot.received', summaries });
}

describe('deployed REST and SSE contract reconciliation scenarios', () => {
  test('reconciles retrieval, live progress, out-of-order delivery, and reconnect recovery', async () => {
    const initialPage = statusPage([retrievalOnlyStatus('2026-08-07T13:59:00Z'), runStatus()]);
    const recoveryPage = statusPage([
      runStatus({
        studyInstanceUID: retrievalStudyUID,
        runId: 'run-1',
        runNumber: 1,
        trigger: 'AUTO',
        phase: 'PROCESSING',
        expectedModels: 2,
        completedModels: 1,
        runningModels: 1,
        activeModels: 1,
        version: 3,
        updatedAt: '2026-08-07T14:04:00Z',
      }),
      runStatus({
        phase: 'TERMINAL',
        outcome: 'SUCCESS_WITH_SKIPS',
        completedModels: 2,
        skippedModels: 1,
        runningModels: 0,
        activeModels: 0,
        attentionRequired: true,
        attentionReasons: [{ code: 'EXPECTED_JOB_MISSING', message: 'Expected model skipped.' }],
        version: 7,
        completedAt: '2026-08-07T14:05:00Z',
        updatedAt: '2026-08-07T14:05:00Z',
      }),
    ]);
    const backend = createMockBackend([initialPage, recoveryPage]);
    const repository = createStudyProcessingRESTRepository(backend.client);
    const snapshotTransport = createRESTStudyProcessingSnapshotTransport(repository);
    let state = studyProcessingReducer(initialStudyProcessingState, {
      type: 'initialSnapshot.started',
    });

    state = receiveSnapshot(
      state,
      await snapshotTransport.loadVisibleStudySnapshot([retrievalStudyUID, processingStudyUID])
    );
    expect(state.summariesByStudyInstanceUID[retrievalStudyUID]).toMatchObject({
      lifecycle: 'RETRIEVING',
      runId: null,
      version: null,
    });

    await streamEvents(
      [
        liveEvent({ version: 6, completedModels: 2, runningModels: 1 }),
        liveEvent({ version: 5, completedModels: 1, runningModels: 2 }),
      ],
      summary => {
        state = studyProcessingReducer(state, { type: 'status.updated', summary });
      }
    );
    expect(state.summariesByStudyInstanceUID[processingStudyUID].version).toBe(6);

    state = receiveSnapshot(
      state,
      await snapshotTransport.loadVisibleStudySnapshot([retrievalStudyUID, processingStudyUID])
    );

    expect(state.summariesByStudyInstanceUID[retrievalStudyUID]).toMatchObject({
      runNumber: 1,
      version: 3,
      lifecycle: 'PROCESSING',
    });
    expect(state.summariesByStudyInstanceUID[processingStudyUID]).toMatchObject({
      version: 7,
      outcome: 'SUCCESS_WITH_SKIPS',
      attentionRequired: true,
    });

    const firstRequestParams = backend.get.mock.calls[0][1].params as URLSearchParams;
    expect(firstRequestParams.getAll('studyInstanceUID')).toEqual([
      retrievalStudyUID,
      processingStudyUID,
    ]);
    expect(firstRequestParams.has('tenantId')).toBe(false);
  });

  test('maps a legacy history snapshot with nullable execution fields without N+1 requests', async () => {
    const backend = createMockBackend([statusPage([runStatus()])]);
    const repository = createStudyProcessingRESTRepository(backend.client);
    const historyTransport = createRESTRunHistoryTransport(repository);

    const result = await historyTransport.loadRunHistory(processingStudyUID);

    expect(result.partial).toBe(false);
    expect(result.history.runs[0]).toMatchObject({
      trigger: 'LEGACY_IMPORT',
      startedAt: null,
      completedAt: null,
      attentionReasons: [{ code: 'LEGACY_HISTORY_INCOMPLETE', message: null }],
    });
    expect(result.history.runs[0].modelExecutions[0]).toMatchObject({
      candidateId: null,
      studyServiceJobId: null,
      modelVersion: null,
      modality: null,
      queuedAt: null,
      startedAt: null,
      completedAt: null,
      skipReason: { code: 'MODEL_NOT_APPLICABLE', message: null },
    });
    expect(
      backend.get.mock.calls.filter(([path]) => path.includes('/processing/runs/'))
    ).toHaveLength(0);
  });
});
