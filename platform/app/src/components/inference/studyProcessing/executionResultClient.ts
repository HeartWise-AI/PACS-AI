import Api from '../../../pacsAPIAxios';
import type { ProcessingRunExecutionResultDTO, WorklistAPIResponse } from './restDTO';
import type { ModelExecutionResult, ModelExecutionResultFailure } from './types';

interface HTTPResponse<T> {
  data: T;
}

export interface ExecutionResultHTTPClient {
  get<T>(url: string, config?: { signal?: AbortSignal }): Promise<HTTPResponse<T>>;
}

export interface LoadModelExecutionResultRequest {
  runId: string;
  executionId: string;
  signal?: AbortSignal;
}

export interface ModelExecutionResultClient {
  loadExecutionResult(request: LoadModelExecutionResultRequest): Promise<ModelExecutionResult>;
}

export class ModelExecutionResultClientError extends Error {
  readonly failure: ModelExecutionResultFailure;

  constructor(failure: ModelExecutionResultFailure) {
    super(failure.message);
    this.name = 'ModelExecutionResultClientError';
    this.failure = failure;
  }
}

export class ModelExecutionResultAbortedError extends Error {
  constructor() {
    super('Model result request was cancelled.');
    this.name = 'ModelExecutionResultAbortedError';
  }
}

function requiredPathIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ModelExecutionResultClientError({
      kind: 'unknown',
      status: 400,
      errorCode: 'INVALID_PAYLOAD',
      retryable: false,
      message: `${label} is required.`,
    });
  }

  return encodeURIComponent(normalized);
}

function responseStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null;
  }

  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : null;
}

const KNOWN_RESULT_ERROR_CODES = new Set([
  'INVALID_PAYLOAD',
  'UNAUTHORIZED_ACCESS',
  'FORBIDDEN_ACCESS',
  'MISSING_RECORD',
  'INFERENCE_EXECUTION_RESULT_NOT_AVAILABLE',
  'INFERENCE_EXECUTION_RESULT_INVALID',
  'INFERENCE_RESULT_SERVICE_UNAVAILABLE',
  'SERVER_ERROR',
  'DATABASE_ERROR',
]);

function responseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null;
  }

  const response = (error as { response?: { data?: { errorCode?: unknown } } }).response;
  const errorCode = response?.data?.errorCode;
  return typeof errorCode === 'string' && KNOWN_RESULT_ERROR_CODES.has(errorCode)
    ? errorCode
    : null;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === 'AbortError' || candidate.code === 'ERR_CANCELED';
}

function normalizedFailure(error: unknown): ModelExecutionResultFailure {
  const status = responseStatus(error);
  const errorCode = responseErrorCode(error);

  switch (status) {
    case 401:
    case 403:
      return {
        kind: 'forbidden',
        status,
        errorCode,
        retryable: false,
        message: 'You do not have permission to view this model result.',
      };
    case 404:
      return {
        kind: 'not_found',
        status,
        errorCode,
        retryable: false,
        message: 'The model execution result was not found.',
      };
    case 409:
      return {
        kind: 'not_available',
        status,
        errorCode,
        retryable: false,
        message: 'This model execution does not have a viewable completed result.',
      };
    case 422:
      return {
        kind: 'invalid_result',
        status,
        errorCode,
        retryable: false,
        message: 'The completed model result is unavailable.',
      };
    case 500:
    case 502:
    case 503:
    case 504:
    case null:
      return {
        kind: 'service_unavailable',
        status,
        errorCode,
        retryable: true,
        message: 'Model results are temporarily unavailable.',
      };
    default:
      return {
        kind: 'unknown',
        status,
        errorCode,
        retryable: false,
        message: 'The model result could not be loaded.',
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapExecutionResult(
  value: unknown,
  expectedRunId: string,
  expectedExecutionId: string
): ModelExecutionResult {
  if (!isRecord(value)) {
    throwInvalidResultResponse();
  }

  const dto = value as unknown as ProcessingRunExecutionResultDTO;
  const hasResult = Object.prototype.hasOwnProperty.call(value, 'result');
  const valid =
    dto.runId === expectedRunId &&
    dto.executionId === expectedExecutionId &&
    typeof dto.studyInstanceUID === 'string' &&
    dto.studyInstanceUID.trim() !== '' &&
    typeof dto.modelName === 'string' &&
    dto.modelName.trim() !== '' &&
    (typeof dto.modelVersion === 'string' || dto.modelVersion === null) &&
    dto.status === 'completed' &&
    typeof dto.completedAt === 'string' &&
    !Number.isNaN(Date.parse(dto.completedAt)) &&
    hasResult &&
    dto.result !== null &&
    dto.result !== undefined;

  if (!valid) {
    throwInvalidResultResponse();
  }

  return {
    runId: dto.runId,
    executionId: dto.executionId,
    studyInstanceUID: dto.studyInstanceUID,
    modelName: dto.modelName,
    modelVersion: dto.modelVersion,
    status: dto.status,
    completedAt: dto.completedAt,
    result: dto.result,
  };
}

function throwInvalidResultResponse(): never {
  throw new ModelExecutionResultClientError({
    kind: 'invalid_result',
    status: null,
    errorCode: null,
    retryable: false,
    message: 'The completed model result is unavailable.',
  });
}

export function createModelExecutionResultClient(
  client: ExecutionResultHTTPClient = Api() as ExecutionResultHTTPClient
): ModelExecutionResultClient {
  return {
    async loadExecutionResult(
      request: LoadModelExecutionResultRequest
    ): Promise<ModelExecutionResult> {
      const runId = request.runId.trim();
      const executionId = request.executionId.trim();
      const encodedRunId = requiredPathIdentifier(runId, 'Processing run ID');
      const encodedExecutionId = requiredPathIdentifier(executionId, 'Model execution ID');

      try {
        const response = await client.get<WorklistAPIResponse<ProcessingRunExecutionResultDTO>>(
          `/v1/inference/processing/runs/${encodedRunId}/executions/${encodedExecutionId}/result`,
          request.signal ? { signal: request.signal } : undefined
        );

        if (!response.data.success) {
          throw new ModelExecutionResultClientError({
            kind: 'unknown',
            status: null,
            errorCode: null,
            retryable: false,
            message: 'The model result could not be loaded.',
          });
        }

        return mapExecutionResult(response.data.data, runId, executionId);
      } catch (error: unknown) {
        if (error instanceof ModelExecutionResultClientError) {
          throw error;
        }
        if (isAbortError(error)) {
          throw new ModelExecutionResultAbortedError();
        }

        throw new ModelExecutionResultClientError(normalizedFailure(error));
      }
    },
  };
}
