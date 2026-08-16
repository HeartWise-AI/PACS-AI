import type { ModelExecutionResult, ModelExecutionResultFailure } from './types';

const BASE_RESULT = {
  runId: 'run-result-1',
  executionId: 'execution-result-1',
  studyInstanceUID: '1.2.840.113619.2.55.3.604688.12',
  modelName: 'CardioSyntax',
  modelVersion: '1.0.0',
  status: 'completed',
  completedAt: '2026-08-11T14:30:00Z',
} as const;

export const modelExecutionResultFixtures = {
  available: {
    ...BASE_RESULT,
    result: { syntax_score: 24.5, classification: 'intermediate' },
  },
  emptyObject: {
    ...BASE_RESULT,
    executionId: 'execution-empty-object',
    result: {},
  },
  emptyArray: {
    ...BASE_RESULT,
    executionId: 'execution-empty-array',
    result: [],
  },
  nested: {
    ...BASE_RESULT,
    executionId: 'execution-nested',
    result: {
      summary: { classification: 'intermediate' },
      measurements: [
        { name: 'syntax_score', value: 24.5, unit: 'points' },
        { name: 'confidence', value: 0.92, unit: null },
      ],
    },
  },
  unknownShape: {
    ...BASE_RESULT,
    executionId: 'execution-unknown-shape',
    modelName: 'FutureModel',
    modelVersion: '9.0.0',
    result: 'future scalar payload',
  },
} satisfies Record<string, ModelExecutionResult>;

export const modelExecutionResultFailureFixtures = {
  notReady: {
    kind: 'not_available',
    status: 409,
    errorCode: 'INFERENCE_EXECUTION_RESULT_NOT_AVAILABLE',
    retryable: false,
    message: 'This model execution does not have a viewable completed result.',
  },
  terminalWithoutResult: {
    kind: 'invalid_result',
    status: 422,
    errorCode: 'INFERENCE_EXECUTION_RESULT_INVALID',
    retryable: false,
    message: 'The completed model result is unavailable.',
  },
  malformed: {
    kind: 'invalid_result',
    status: 422,
    errorCode: 'INFERENCE_EXECUTION_RESULT_INVALID',
    retryable: false,
    message: 'The completed model result is unavailable.',
  },
  forbidden: {
    kind: 'forbidden',
    status: 403,
    errorCode: 'FORBIDDEN_ACCESS',
    retryable: false,
    message: 'You do not have permission to view this model result.',
  },
  notFound: {
    kind: 'not_found',
    status: 404,
    errorCode: 'MISSING_RECORD',
    retryable: false,
    message: 'The model execution result was not found.',
  },
  upstreamUnavailable: {
    kind: 'service_unavailable',
    status: 503,
    errorCode: 'INFERENCE_RESULT_SERVICE_UNAVAILABLE',
    retryable: true,
    message: 'Model results are temporarily unavailable.',
  },
} satisfies Record<string, ModelExecutionResultFailure>;
