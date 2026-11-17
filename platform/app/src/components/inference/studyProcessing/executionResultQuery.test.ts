import {
  ModelExecutionResultClientError,
  type LoadModelExecutionResultRequest,
  type ModelExecutionResultClient,
} from './executionResultClient';
import { modelExecutionResultFixtures } from './executionResultFixtures';
import {
  initialModelExecutionResultQueryState,
  ModelExecutionResultQueryCoordinator,
  modelExecutionResultQueryKey,
  type ModelExecutionResultSelection,
} from './executionResultQuery';
import type { ModelExecutionResult } from './types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function selection(
  overrides: Partial<ModelExecutionResultSelection> = {}
): ModelExecutionResultSelection {
  return {
    studyInstanceUID: modelExecutionResultFixtures.available.studyInstanceUID,
    runId: modelExecutionResultFixtures.available.runId,
    executionId: modelExecutionResultFixtures.available.executionId,
    modelName: modelExecutionResultFixtures.available.modelName,
    modelVersion: modelExecutionResultFixtures.available.modelVersion,
    status: 'completed',
    ...overrides,
  };
}

describe('model execution result query coordinator', () => {
  test('does not request or retain anything before explicit selection', () => {
    const client = { loadExecutionResult: jest.fn() } as ModelExecutionResultClient;
    const coordinator = new ModelExecutionResultQueryCoordinator(client);

    expect(coordinator.getSnapshot()).toBe(initialModelExecutionResultQueryState);
    expect(client.loadExecutionResult).not.toHaveBeenCalled();
  });

  test('keys request state by both run and execution IDs without delimiter collisions', () => {
    expect(modelExecutionResultQueryKey('run-a', 'execution-b')).not.toBe(
      modelExecutionResultQueryKey('run', 'a,execution-b')
    );
    expect(modelExecutionResultQueryKey(' run-a ', ' execution-b ')).toBe(
      modelExecutionResultQueryKey('run-a', 'execution-b')
    );
  });

  test('publishes a fully correlated result and notifies subscribers', async () => {
    const loadExecutionResult = jest.fn().mockResolvedValue(modelExecutionResultFixtures.available);
    const coordinator = new ModelExecutionResultQueryCoordinator({ loadExecutionResult });
    const listener = jest.fn();
    coordinator.subscribe(listener);

    await coordinator.select(selection());

    expect(loadExecutionResult).toHaveBeenCalledTimes(1);
    expect(loadExecutionResult).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-result-1', executionId: 'execution-result-1' })
    );
    expect(coordinator.getSnapshot()).toMatchObject({
      key: modelExecutionResultQueryKey('run-result-1', 'execution-result-1'),
      status: 'ready',
      result: modelExecutionResultFixtures.available,
      failure: null,
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('aborts and ignores a late prior response after selection changes', async () => {
    const first = deferred<ModelExecutionResult>();
    const second = deferred<ModelExecutionResult>();
    const requests: LoadModelExecutionResultRequest[] = [];
    const loadExecutionResult = jest
      .fn()
      .mockImplementationOnce((request: LoadModelExecutionResultRequest) => {
        requests.push(request);
        return first.promise;
      })
      .mockImplementationOnce((request: LoadModelExecutionResultRequest) => {
        requests.push(request);
        return second.promise;
      });
    const coordinator = new ModelExecutionResultQueryCoordinator({ loadExecutionResult });
    const nextResult = {
      ...modelExecutionResultFixtures.available,
      executionId: 'execution-result-2',
      modelName: 'NextModel',
    };

    const firstSelection = coordinator.select(selection());
    const secondSelection = coordinator.select(
      selection({ executionId: nextResult.executionId, modelName: nextResult.modelName })
    );
    expect(requests[0].signal?.aborted).toBe(true);
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'loading', result: null });

    second.resolve(nextResult);
    await secondSelection;
    first.resolve(modelExecutionResultFixtures.available);
    await firstSelection;

    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'ready',
      result: nextResult,
      selection: { executionId: 'execution-result-2', modelName: 'NextModel' },
    });
  });

  test('clears selected data and ignores a response that arrives after close or logout', async () => {
    const pending = deferred<ModelExecutionResult>();
    const loadExecutionResult = jest.fn().mockReturnValue(pending.promise);
    const coordinator = new ModelExecutionResultQueryCoordinator({ loadExecutionResult });

    const request = coordinator.select(selection());
    const signal = loadExecutionResult.mock.calls[0][0].signal as AbortSignal;
    coordinator.clear();
    expect(signal.aborted).toBe(true);
    expect(coordinator.getSnapshot()).toBe(initialModelExecutionResultQueryState);

    pending.resolve(modelExecutionResultFixtures.available);
    await request;
    expect(coordinator.getSnapshot()).toBe(initialModelExecutionResultQueryState);
  });

  test('rejects response metadata that no longer matches the selected study or model', async () => {
    const loadExecutionResult = jest.fn().mockResolvedValue({
      ...modelExecutionResultFixtures.available,
      studyInstanceUID: 'different-study',
    });
    const coordinator = new ModelExecutionResultQueryCoordinator({ loadExecutionResult });

    await coordinator.select(selection());

    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'error',
      result: null,
      failure: { kind: 'invalid_result', retryable: false },
    });
  });

  test('never requests a non-completed execution', async () => {
    const loadExecutionResult = jest.fn();
    const coordinator = new ModelExecutionResultQueryCoordinator({ loadExecutionResult });

    await coordinator.select(selection({ status: 'failed' }));

    expect(loadExecutionResult).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'error',
      result: null,
      failure: { kind: 'not_available', retryable: false },
    });
  });

  test('retries only transient failures and replaces error state with fresh loading state', async () => {
    const retryableError = new ModelExecutionResultClientError({
      kind: 'service_unavailable',
      status: 503,
      errorCode: 'INFERENCE_RESULT_SERVICE_UNAVAILABLE',
      retryable: true,
      message: 'Model results are temporarily unavailable.',
    });
    const loadExecutionResult = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(modelExecutionResultFixtures.available);
    const coordinator = new ModelExecutionResultQueryCoordinator({ loadExecutionResult });

    await coordinator.select(selection());
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'error',
      failure: { retryable: true },
    });
    await expect(coordinator.retry()).resolves.toBe(true);
    expect(loadExecutionResult).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot()).toMatchObject({ status: 'ready', failure: null });

    loadExecutionResult.mockRejectedValueOnce(
      new ModelExecutionResultClientError({
        kind: 'not_found',
        status: 404,
        errorCode: 'MISSING_RECORD',
        retryable: false,
        message: 'The model execution result was not found.',
      })
    );
    await coordinator.select(selection({ executionId: 'missing-execution' }));
    await expect(coordinator.retry()).resolves.toBe(false);
    expect(loadExecutionResult).toHaveBeenCalledTimes(3);
  });

  test('drops unknown error detail and exposes only safe transient state', async () => {
    const client = {
      loadExecutionResult: jest.fn().mockRejectedValue(new Error('patient=private token=private')),
    };
    const coordinator = new ModelExecutionResultQueryCoordinator(client);

    await coordinator.select(selection());

    const serialized = JSON.stringify(coordinator.getSnapshot());
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'error',
      failure: { kind: 'service_unavailable', retryable: true },
    });
    expect(serialized).not.toMatch(/patient|private|token/);
  });
});
