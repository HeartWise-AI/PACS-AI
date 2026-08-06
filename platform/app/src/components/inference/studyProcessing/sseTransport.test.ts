import type { WorklistStudyStatusEventDTO } from './restDTO';
import { WORKLIST_STUDY_STATUS_EVENT } from './sseParser';
import {
  streamStudyProcessingEvents,
  StudyProcessingSSEError,
  type StudyProcessingSSEFetch,
  type StudyProcessingSSEResponse,
} from './sseTransport';

const eventPayload: WorklistStudyStatusEventDTO = {
  type: WORKLIST_STUDY_STATUS_EVENT,
  studyInstanceUID: '1.2.840.113619.2.55.3.604688433.123',
  runId: 'run-4',
  runNumber: 4,
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
  startedAt: '2026-08-06T15:00:00Z',
  completedAt: null,
  updatedAt: '2026-08-06T15:01:00Z',
};

function encode(text: string): Uint8Array {
  return Uint8Array.from([...text].map(character => character.charCodeAt(0)));
}

function createTextDecoder() {
  return {
    decode: (input?: Uint8Array) => (input ? String.fromCharCode(...Array.from(input)) : ''),
  };
}

function createResponse(
  chunks: string[],
  overrides: Partial<StudyProcessingSSEResponse> = {}
): { response: StudyProcessingSSEResponse; releaseLock: jest.Mock } {
  let chunkIndex = 0;
  const releaseLock = jest.fn();
  const response: StudyProcessingSSEResponse = {
    ok: true,
    status: 200,
    headers: {
      get: name =>
        name.toLowerCase() === 'content-type' ? 'text/event-stream; charset=utf-8' : null,
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (chunkIndex >= chunks.length) {
            return { done: true };
          }
          return { done: false, value: encode(chunks[chunkIndex++]) };
        },
        releaseLock,
      }),
    },
    ...overrides,
  };

  return { response, releaseLock };
}

function encodeEvent(payload: unknown = eventPayload): string {
  return `event: ${WORKLIST_STUDY_STATUS_EVENT}\ndata: ${JSON.stringify(payload)}\n\n`;
}

describe('study processing SSE transport', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('opens the configured endpoint with the existing bearer token', async () => {
    localStorage.setItem('sessionToken', 'frontend-session-token');
    const { response } = createResponse([]);
    const fetchImplementation = jest.fn().mockResolvedValue(response);

    await streamStudyProcessingEvents({
      apiBaseURL: 'https://api.example.test/',
      fetchImplementation,
      createTextDecoder,
      onEvent: jest.fn(),
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example.test/v1/inference/worklist/events',
      {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: 'Bearer frontend-session-token',
        },
        signal: undefined,
      }
    );
    expect(fetchImplementation.mock.calls[0][0]).not.toContain('frontend-session-token');
    expect(fetchImplementation.mock.calls[0][0]).not.toContain('tenant');
  });

  it('decodes chunked bytes and emits validated study updates', async () => {
    const encodedEvent = `: connected\n\n${encodeEvent()}`;
    const { response, releaseLock } = createResponse([
      encodedEvent.slice(0, 17),
      encodedEvent.slice(17, 91),
      encodedEvent.slice(91),
      ': heartbeat\n\n',
    ]);
    const onEvent = jest.fn();

    await streamStudyProcessingEvents({
      apiBaseURL: '',
      getAuthorizationHeader: () => ({ Authorization: 'Bearer token' }),
      fetchImplementation: jest.fn().mockResolvedValue(response),
      createTextDecoder,
      onEvent,
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(eventPayload);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it('reports an invalid named event without exposing it as an update', async () => {
    const { response } = createResponse([encodeEvent({ ...eventPayload, version: 0 })]);
    const onEvent = jest.fn();
    const onInvalidEvent = jest.fn();

    await streamStudyProcessingEvents({
      getAuthorizationHeader: () => ({ Authorization: 'Bearer token' }),
      fetchImplementation: jest.fn().mockResolvedValue(response),
      createTextDecoder,
      onEvent,
      onInvalidEvent,
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(onInvalidEvent).toHaveBeenCalledTimes(1);
  });

  it('fails before fetching when no bearer token is available', async () => {
    const fetchImplementation = jest.fn() as jest.MockedFunction<StudyProcessingSSEFetch>;

    await expect(
      streamStudyProcessingEvents({
        fetchImplementation,
        onEvent: jest.fn(),
      })
    ).rejects.toMatchObject<Partial<StudyProcessingSSEError>>({ status: 401 });

    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'Authentication is required'],
    [403, 'permission'],
    [503, 'temporarily unavailable'],
  ])('returns a safe error for HTTP %i', async (status, expectedMessage) => {
    const { response } = createResponse([], { ok: false, status });

    await expect(
      streamStudyProcessingEvents({
        getAuthorizationHeader: () => ({ Authorization: 'Bearer token' }),
        fetchImplementation: jest.fn().mockResolvedValue(response),
        onEvent: jest.fn(),
      })
    ).rejects.toMatchObject({ status, message: expect.stringContaining(expectedMessage) });
  });

  it('rejects a successful response that is not an event stream', async () => {
    const { response } = createResponse([], {
      headers: { get: () => 'application/json' },
    });

    await expect(
      streamStudyProcessingEvents({
        getAuthorizationHeader: () => ({ Authorization: 'Bearer token' }),
        fetchImplementation: jest.fn().mockResolvedValue(response),
        onEvent: jest.fn(),
      })
    ).rejects.toMatchObject({
      status: 200,
      message: 'The live processing update service returned an invalid response.',
    });
  });

  it('rejects a response without a readable body', async () => {
    const { response } = createResponse([], { body: null });

    await expect(
      streamStudyProcessingEvents({
        getAuthorizationHeader: () => ({ Authorization: 'Bearer token' }),
        fetchImplementation: jest.fn().mockResolvedValue(response),
        onEvent: jest.fn(),
      })
    ).rejects.toMatchObject({
      status: 200,
      message: 'The live processing update stream was unavailable.',
    });
  });
});
