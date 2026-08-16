import type { ModelExecutionResultFailure } from './types';

export interface ModelExecutionResultFailurePresentation {
  key: string;
  defaultValue: string;
}

const FAILURE_PRESENTATIONS: Record<
  ModelExecutionResultFailure['kind'],
  ModelExecutionResultFailurePresentation
> = {
  forbidden: {
    key: 'ProcessingModelResultForbidden',
    defaultValue:
      'Your session has expired or you do not have permission to view this model result.',
  },
  not_found: {
    key: 'ProcessingModelResultNotFound',
    defaultValue: 'This model result is unavailable or you no longer have access to it.',
  },
  not_available: {
    key: 'ProcessingModelResultNotReady',
    defaultValue: 'This execution does not have a viewable completed result.',
  },
  invalid_result: {
    key: 'ProcessingModelResultInvalid',
    defaultValue: 'The execution completed, but its result is missing or cannot be displayed.',
  },
  service_unavailable: {
    key: 'ProcessingModelResultUnavailable',
    defaultValue: 'Model results are temporarily unavailable. Try again in a moment.',
  },
  unknown: {
    key: 'ProcessingModelResultUnknownError',
    defaultValue: 'The model result could not be displayed.',
  },
};

export function getModelExecutionResultFailurePresentation(
  failure: ModelExecutionResultFailure | null
): ModelExecutionResultFailurePresentation {
  return failure ? FAILURE_PRESENTATIONS[failure.kind] : FAILURE_PRESENTATIONS.unknown;
}

export function isEmptyModelExecutionResult(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return typeof value === 'object' && value !== null && Object.keys(value).length === 0;
}
