import type { InferenceModelDeploymentEvent } from '../../../api/inferenceDTO';
import {
  MODEL_DEPLOYMENT_EVENT,
  streamModelDeploymentEvents,
  type ModelDeploymentSSEResponse,
} from './modelDeploymentSSE';

const progress: InferenceModelDeploymentEvent = {
  deploymentId: 'deployment-1',
  status: 'RUNNING',
  stage: 'pull',
  sequence: 4,
  timestamp: 1000,
  elapsedMilliseconds: 400,
  terminal: false,
};

function encode(text: string): Uint8Array {
  return Uint8Array.from([...text].map(character => character.charCodeAt(0)));
}

function responseWithChunks(chunks: string[]): ModelDeploymentSSEResponse {
  let index = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream; charset=utf-8' },
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length ? { done: false, value: encode(chunks[index++]) } : { done: true },
        releaseLock: jest.fn(),
      }),
    },
  };
}

const decoder = () => ({
  decode: (input?: Uint8Array) => (input ? String.fromCharCode(...Array.from(input)) : ''),
});

describe('model deployment SSE transport', () => {
  afterEach(() => localStorage.clear());

  test('authenticates, resumes from the durable sequence, and decodes progress', async () => {
    localStorage.setItem('sessionToken', 'session-token');
    const encoded = `id: 4\nevent: ${MODEL_DEPLOYMENT_EVENT}\ndata: ${JSON.stringify(progress)}\n\n`;
    const fetchImplementation = jest
      .fn()
      .mockResolvedValue(responseWithChunks([encoded.slice(0, 19), encoded.slice(19)]));
    const onEvent = jest.fn();

    await streamModelDeploymentEvents({
      modelId: 'model/one',
      deploymentId: 'deployment-1',
      lastEventId: 3,
      apiBaseURL: 'https://api.example.test/',
      fetchImplementation,
      createTextDecoder: decoder,
      onEvent,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example.test/v1/inference/model/model%2Fone/deployments/deployment-1/events',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: 'Bearer session-token',
          'Last-Event-ID': '3',
        },
      })
    );
    expect(onEvent).toHaveBeenCalledWith(progress);
  });

  test('rejects malformed deployment events without exposing them', async () => {
    const encoded = `event: ${MODEL_DEPLOYMENT_EVENT}\ndata: ${JSON.stringify({
      ...progress,
      sequence: 0,
    })}\n\n`;
    const onEvent = jest.fn();
    const onInvalidEvent = jest.fn();

    await streamModelDeploymentEvents({
      modelId: 'model-1',
      deploymentId: 'deployment-1',
      getAuthorizationHeader: () => ({ Authorization: 'Bearer token' }),
      fetchImplementation: jest.fn().mockResolvedValue(responseWithChunks([encoded])),
      createTextDecoder: decoder,
      onEvent,
      onInvalidEvent,
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(onInvalidEvent).toHaveBeenCalledTimes(1);
  });
});
