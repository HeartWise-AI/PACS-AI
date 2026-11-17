export const MODEL_EXECUTION_RESULT_OPENAPI_PATH =
  '/inference/processing/runs/{runId}/executions/{executionId}/result';

export const MODEL_EXECUTION_RESULT_CLIENT_PATH_PREFIX = '/v1';

export const MODEL_EXECUTION_RESULT_HTTP_STATUSES = [
  200, 400, 401, 403, 404, 409, 422, 500, 503,
] as const;

export const MODEL_EXECUTION_RESULT_ERROR_CODES = {
  invalidPayload: 'INVALID_PAYLOAD',
  unauthorized: 'UNAUTHORIZED_ACCESS',
  forbidden: 'FORBIDDEN_ACCESS',
  missing: 'MISSING_RECORD',
  notAvailable: 'INFERENCE_EXECUTION_RESULT_NOT_AVAILABLE',
  invalidResult: 'INFERENCE_EXECUTION_RESULT_INVALID',
  serviceUnavailable: 'INFERENCE_RESULT_SERVICE_UNAVAILABLE',
  serverError: 'SERVER_ERROR',
  databaseError: 'DATABASE_ERROR',
} as const;

export const KNOWN_MODEL_EXECUTION_RESULT_ERROR_CODES = new Set<string>(
  Object.values(MODEL_EXECUTION_RESULT_ERROR_CODES)
);

export function buildModelExecutionResultPath(
  encodedRunId: string,
  encodedExecutionId: string
): string {
  const openAPIPath = MODEL_EXECUTION_RESULT_OPENAPI_PATH.replace('{runId}', encodedRunId).replace(
    '{executionId}',
    encodedExecutionId
  );
  return `${MODEL_EXECUTION_RESULT_CLIENT_PATH_PREFIX}${openAPIPath}`;
}
