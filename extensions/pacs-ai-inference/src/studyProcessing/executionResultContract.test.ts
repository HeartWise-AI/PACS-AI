import {
  buildModelExecutionResultPath,
  KNOWN_MODEL_EXECUTION_RESULT_ERROR_CODES,
  MODEL_EXECUTION_RESULT_ERROR_CODES,
  MODEL_EXECUTION_RESULT_HTTP_STATUSES,
  MODEL_EXECUTION_RESULT_OPENAPI_PATH,
} from './executionResultContract';
import { modelExecutionResultFixtures } from './executionResultFixtures';

describe('backend execution-result contract reconciliation', () => {
  test('matches the backend OpenAPI path and v1 browser route', () => {
    expect(MODEL_EXECUTION_RESULT_OPENAPI_PATH).toBe(
      '/inference/processing/runs/{runId}/executions/{executionId}/result'
    );
    expect(buildModelExecutionResultPath('run-1', 'execution-1')).toBe(
      '/v1/inference/processing/runs/run-1/executions/execution-1/result'
    );
  });

  test('matches the backend public response envelope fields', () => {
    expect(Object.keys(modelExecutionResultFixtures.available)).toEqual([
      'runId',
      'executionId',
      'studyInstanceUID',
      'modelName',
      'modelVersion',
      'status',
      'completedAt',
      'result',
    ]);
  });

  test('matches the backend stable statuses and error codes', () => {
    expect(MODEL_EXECUTION_RESULT_HTTP_STATUSES).toEqual([
      200, 400, 401, 403, 404, 409, 422, 500, 503,
    ]);
    expect(MODEL_EXECUTION_RESULT_ERROR_CODES).toEqual({
      invalidPayload: 'INVALID_PAYLOAD',
      unauthorized: 'UNAUTHORIZED_ACCESS',
      forbidden: 'FORBIDDEN_ACCESS',
      missing: 'MISSING_RECORD',
      notAvailable: 'INFERENCE_EXECUTION_RESULT_NOT_AVAILABLE',
      invalidResult: 'INFERENCE_EXECUTION_RESULT_INVALID',
      serviceUnavailable: 'INFERENCE_RESULT_SERVICE_UNAVAILABLE',
      serverError: 'SERVER_ERROR',
      databaseError: 'DATABASE_ERROR',
    });
    expect(KNOWN_MODEL_EXECUTION_RESULT_ERROR_CODES).toEqual(
      new Set(Object.values(MODEL_EXECUTION_RESULT_ERROR_CODES))
    );
  });
});
