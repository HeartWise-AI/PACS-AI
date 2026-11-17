import {
  createModelExecutionResultClient,
  ModelExecutionResultAbortedError,
  ModelExecutionResultClientError,
  type ExecutionResultHTTPClient,
} from './executionResultClient';
import { modelExecutionResultFixtures } from './executionResultFixtures';

function backendWithResponse(data: unknown) {
  const get = jest.fn().mockResolvedValue({ data });
  return { client: { get } as ExecutionResultHTTPClient, get };
}

function httpError(status: number, errorCode: string, message = 'private backend detail') {
  return { response: { status, data: { errorCode, message, privatePayload: 'must-not-leak' } } };
}

describe('model execution result client', () => {
  test('constructs one encoded lazy request and maps the opaque result', async () => {
    const backend = backendWithResponse({
      success: true,
      message: 'ok',
      data: modelExecutionResultFixtures.available,
    });
    const client = createModelExecutionResultClient(backend.client);
    const controller = new AbortController();

    const result = await client.loadExecutionResult({
      runId: ' run-result-1 ',
      executionId: ' execution-result-1 ',
      signal: controller.signal,
    });

    expect(backend.get).toHaveBeenCalledTimes(1);
    expect(backend.get).toHaveBeenCalledWith(
      '/v1/inference/processing/runs/run-result-1/executions/execution-result-1/result',
      { signal: controller.signal }
    );
    expect(result).toEqual(modelExecutionResultFixtures.available);
    expect(backend.get.mock.calls[0][0]).not.toContain('tenant');
  });

  test('encodes path segments and rejects missing IDs before transport', async () => {
    const backend = backendWithResponse({
      success: true,
      data: {
        ...modelExecutionResultFixtures.available,
        runId: 'run/one',
        executionId: 'execution?one',
      },
    });
    const client = createModelExecutionResultClient(backend.client);

    await client.loadExecutionResult({ runId: 'run/one', executionId: 'execution?one' });
    expect(backend.get.mock.calls[0][0]).toBe(
      '/v1/inference/processing/runs/run%2Fone/executions/execution%3Fone/result'
    );

    await expect(
      client.loadExecutionResult({ runId: ' ', executionId: 'execution-1' })
    ).rejects.toMatchObject({
      failure: { status: 400, retryable: false },
    });
    expect(backend.get).toHaveBeenCalledTimes(1);
  });

  test.each([
    [401, 'UNAUTHORIZED_ACCESS', 'forbidden', false],
    [403, 'FORBIDDEN_ACCESS', 'forbidden', false],
    [404, 'MISSING_RECORD', 'not_found', false],
    [409, 'INFERENCE_EXECUTION_RESULT_NOT_AVAILABLE', 'not_available', false],
    [422, 'INFERENCE_EXECUTION_RESULT_INVALID', 'invalid_result', false],
    [500, 'SERVER_ERROR', 'service_unavailable', true],
    [503, 'INFERENCE_RESULT_SERVICE_UNAVAILABLE', 'service_unavailable', true],
  ])(
    'normalizes HTTP %i without retaining response content',
    async (status, errorCode, kind, retryable) => {
      const backend = backendWithResponse({});
      backend.get.mockRejectedValue(httpError(status as number, errorCode as string));
      const client = createModelExecutionResultClient(backend.client);

      const request = client.loadExecutionResult({ runId: 'run-1', executionId: 'execution-1' });

      await expect(request).rejects.toMatchObject({
        name: 'ModelExecutionResultClientError',
        failure: { status, errorCode, kind, retryable },
      });
      await expect(request).rejects.not.toThrow(/private|must-not-leak/);
    }
  );

  test('treats network failures as retryable and drops unknown error codes', async () => {
    const backend = backendWithResponse({});
    backend.get.mockRejectedValueOnce(new Error('socket included private address'));
    backend.get.mockRejectedValueOnce(httpError(418, 'UNTRUSTED_PRIVATE_CODE'));
    const client = createModelExecutionResultClient(backend.client);

    await expect(
      client.loadExecutionResult({ runId: 'run-1', executionId: 'execution-1' })
    ).rejects.toMatchObject({
      failure: { kind: 'service_unavailable', status: null, retryable: true },
    });
    await expect(
      client.loadExecutionResult({ runId: 'run-1', executionId: 'execution-1' })
    ).rejects.toMatchObject({
      failure: { kind: 'unknown', status: 418, errorCode: null, retryable: false },
    });
  });

  test.each([
    ['mismatched run', { runId: 'other-run' }],
    ['mismatched execution', { executionId: 'other-execution' }],
    ['non-completed status', { status: 'running' }],
    ['missing result', { result: null }],
    ['invalid completion time', { completedAt: 'not-a-date' }],
  ])('rejects a malformed success envelope: %s', async (_name, override) => {
    const backend = backendWithResponse({
      success: true,
      data: { ...modelExecutionResultFixtures.available, ...override },
    });
    const client = createModelExecutionResultClient(backend.client);

    await expect(
      client.loadExecutionResult({ runId: 'run-result-1', executionId: 'execution-result-1' })
    ).rejects.toEqual(
      new ModelExecutionResultClientError({
        kind: 'invalid_result',
        status: null,
        errorCode: null,
        retryable: false,
        message: 'The completed model result is unavailable.',
      })
    );
  });

  test('normalizes cancellation separately from a load failure', async () => {
    const backend = backendWithResponse({});
    backend.get.mockRejectedValue({ code: 'ERR_CANCELED', privatePayload: 'must-not-leak' });
    const client = createModelExecutionResultClient(backend.client);

    await expect(
      client.loadExecutionResult({ runId: 'run-1', executionId: 'execution-1' })
    ).rejects.toEqual(new ModelExecutionResultAbortedError());
  });
});
