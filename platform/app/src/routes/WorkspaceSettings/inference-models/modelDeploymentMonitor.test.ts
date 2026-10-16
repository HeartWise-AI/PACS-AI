import type {
  InferenceModelDeploymentEvent,
  InferenceModelDeploymentOperation,
} from '../../../api/inferenceDTO';
import { createModelDeploymentMonitor } from './modelDeploymentMonitor';

const operation = (
  sequence: number,
  status: InferenceModelDeploymentOperation['status'] = 'RUNNING'
): InferenceModelDeploymentOperation => ({
  id: 'deployment-1',
  modelId: 'model-1',
  catalogVersionId: 'version-1',
  requestedVersion: '1.0.1',
  status,
  stage: status === 'COMPLETED' ? 'activate_candidate' : 'pull',
  sequence,
  createdAt: 1000,
  startedAt: 1100,
  updatedAt: 1200 + sequence,
  finishedAt: status === 'COMPLETED' ? 1500 : undefined,
});

const statusResponse = (value: InferenceModelDeploymentOperation) => ({
  success: true,
  message: 'ok',
  data: { deployment: value },
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('model deployment monitor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('uses polling every two seconds after SSE disconnects and stops at terminal state', async () => {
    const getOperation = jest
      .fn()
      .mockResolvedValueOnce(statusResponse(operation(1)))
      .mockResolvedValueOnce(statusResponse(operation(2)))
      .mockResolvedValue(statusResponse(operation(3, 'COMPLETED')));
    const stream = jest.fn().mockRejectedValue(new Error('disconnected'));
    const onProgress = jest.fn();
    const onConnectionMode = jest.fn();
    const onTerminal = jest.fn();
    const monitor = createModelDeploymentMonitor(
      'model-1',
      'deployment-1',
      { onProgress, onConnectionMode, onTerminal },
      { getOperation, stream }
    );

    monitor.start();
    await flushPromises();
    expect(onConnectionMode).toHaveBeenCalledWith('polling');

    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(getOperation).toHaveBeenCalledTimes(3);
    expect(onTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED', terminal: true, sequence: 3 })
    );
    const callsAtCompletion = getOperation.mock.calls.length;
    jest.advanceTimersByTime(6000);
    await flushPromises();
    expect(getOperation).toHaveBeenCalledTimes(callsAtCompletion);
  });

  test('stops polling when SSE reconnects and ignores stale sequences', async () => {
    const getOperation = jest.fn().mockResolvedValue(statusResponse(operation(2)));
    let attempts = 0;
    const stream = jest.fn(async options => {
      attempts++;
      if (attempts === 1) {
        throw new Error('disconnected');
      }
      options.onOpen?.();
      options.onEvent({
        deploymentId: 'deployment-1',
        status: 'RUNNING',
        stage: 'validate_candidate',
        sequence: 3,
        timestamp: 1300,
        elapsedMilliseconds: 200,
        terminal: false,
      } as InferenceModelDeploymentEvent);
      await new Promise<void>(() => undefined);
    });
    const onProgress = jest.fn();
    const onConnectionMode = jest.fn();
    const monitor = createModelDeploymentMonitor(
      'model-1',
      'deployment-1',
      { onProgress, onConnectionMode, onTerminal: jest.fn() },
      { getOperation, stream }
    );

    monitor.start();
    await flushPromises();
    jest.advanceTimersByTime(5000);
    await flushPromises();

    expect(onConnectionMode).toHaveBeenLastCalledWith('live');
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ sequence: 3 }));
    const pollsAfterReconnect = getOperation.mock.calls.length;
    jest.advanceTimersByTime(4000);
    await flushPromises();
    expect(getOperation).toHaveBeenCalledTimes(pollsAfterReconnect);
    monitor.stop();
  });
});
