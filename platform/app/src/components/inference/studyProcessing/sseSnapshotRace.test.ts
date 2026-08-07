import type { WorklistStudyStatusEventDTO } from './restDTO';
import { mapWorklistStudyStatus } from './restMapper';
import {
  initialStudyProcessingState,
  studyProcessingReducer,
  type StudyProcessingState,
} from './reducer';
import { WORKLIST_STUDY_STATUS_EVENT } from './sseParser';
import { streamStudyProcessingEvents, type StudyProcessingSSEResponse } from './sseTransport';
import type { StudyProcessingSummary } from './types';

const studyInstanceUID = '1.2.840.113619.2.55.3.604688433.race';

function liveEvent(
  overrides: Partial<WorklistStudyStatusEventDTO> = {}
): WorklistStudyStatusEventDTO {
  return {
    type: WORKLIST_STUDY_STATUS_EVENT,
    studyInstanceUID,
    runId: 'run-race-2',
    runNumber: 2,
    trigger: 'AUTO',
    phase: 'PROCESSING',
    outcome: null,
    attentionRequired: false,
    attentionReasons: [],
    expectedModels: 3,
    pendingModels: 0,
    queuedModels: 0,
    runningModels: 1,
    completedModels: 2,
    failedModels: 0,
    skippedModels: 0,
    cancelledModels: 0,
    activeModels: 1,
    version: 5,
    startedAt: '2026-08-07T14:00:00Z',
    completedAt: null,
    updatedAt: '2026-08-07T14:01:00Z',
    ...overrides,
  };
}

function restSnapshot(version: number): StudyProcessingSummary {
  return mapWorklistStudyStatus({
    ...liveEvent({ version }),
    ingestionStatus: 'RETRIEVED',
    retrievalState: 'COMPLETED',
    retrievalError: null,
  });
}

function encode(text: string): Uint8Array {
  return Uint8Array.from([...text].map(character => character.charCodeAt(0)));
}

function createTextDecoder() {
  return {
    decode: (input?: Uint8Array) => (input ? String.fromCharCode(...Array.from(input)) : ''),
  };
}

async function streamEvent(
  event: WorklistStudyStatusEventDTO,
  onEvent: (summary: StudyProcessingSummary) => void
): Promise<void> {
  const eventText = `event: ${WORKLIST_STUDY_STATUS_EVENT}\ndata: ${JSON.stringify(event)}\n\n`;
  let delivered = false;
  const response: StudyProcessingSSEResponse = {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: {
      getReader: () => ({
        read: async () => {
          if (delivered) {
            return { done: true };
          }
          delivered = true;
          return { done: false, value: encode(eventText) };
        },
        releaseLock: jest.fn(),
      }),
    },
  };

  await streamStudyProcessingEvents({
    getAuthorizationHeader: () => ({ Authorization: 'Bearer test-token' }),
    fetchImplementation: jest.fn().mockResolvedValue(response),
    createTextDecoder,
    onEvent,
  });
}

function beginInitialSnapshot(): StudyProcessingState {
  return studyProcessingReducer(initialStudyProcessingState, {
    type: 'initialSnapshot.started',
  });
}

describe('SSE and initial REST snapshot reconciliation', () => {
  test('buffers a live update and keeps it when the later REST snapshot is older', async () => {
    let state = beginInitialSnapshot();
    const event = liveEvent({ version: 5 });

    await streamEvent(event, summary => {
      state = studyProcessingReducer(state, { type: 'status.updated', summary });
    });

    expect(state.summariesByStudyInstanceUID).toEqual({});
    expect(state.bufferedSummariesByStudyInstanceUID[studyInstanceUID].version).toBe(5);

    state = studyProcessingReducer(state, {
      type: 'snapshot.received',
      summaries: [restSnapshot(4)],
    });

    expect(state.initialSnapshotStatus).toBe('ready');
    expect(state.bufferedSummariesByStudyInstanceUID).toEqual({});
    expect(state.summariesByStudyInstanceUID[studyInstanceUID].version).toBe(5);
    expect(state.summariesByStudyInstanceUID[studyInstanceUID].retrievalState).toBeNull();
  });

  test('keeps a newer authoritative REST record over an older buffered event', async () => {
    let state = beginInitialSnapshot();

    await streamEvent(liveEvent({ version: 5 }), summary => {
      state = studyProcessingReducer(state, { type: 'status.updated', summary });
    });

    state = studyProcessingReducer(state, {
      type: 'snapshot.received',
      summaries: [restSnapshot(6)],
    });

    expect(state.summariesByStudyInstanceUID[studyInstanceUID].version).toBe(6);
    expect(state.summariesByStudyInstanceUID[studyInstanceUID].retrievalState).toBe('COMPLETED');
  });

  test('keeps only the newest live update while the snapshot is loading', async () => {
    let state = beginInitialSnapshot();

    await streamEvent(liveEvent({ version: 7 }), summary => {
      state = studyProcessingReducer(state, { type: 'status.updated', summary });
    });
    await streamEvent(liveEvent({ version: 6 }), summary => {
      state = studyProcessingReducer(state, { type: 'status.updated', summary });
    });

    expect(state.bufferedSummariesByStudyInstanceUID[studyInstanceUID].version).toBe(7);
  });
});
