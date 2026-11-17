import type { RealtimeConnectionStatus } from './reducer';
import { StudyProcessingSSEError } from './sseTransport';

export const DEFAULT_STUDY_PROCESSING_SSE_TELEMETRY_LIMIT = 100;

export type StudyProcessingSSEErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'network'
  | 'server_error'
  | 'service_unavailable'
  | 'unknown';

export type StudyProcessingSSETelemetryEvent =
  | {
      name: 'connection_state';
      state: RealtimeConnectionStatus;
    }
  | {
      name: 'connection_error';
      category: StudyProcessingSSEErrorCategory;
      status: 401 | 403 | 500 | 503 | null;
    }
  | {
      name: 'retry_scheduled';
      attempt: number;
      delayMs: number;
    }
  | {
      name: 'invalid_event';
    };

export interface StudyProcessingSSETelemetry {
  recordConnectionState(status: RealtimeConnectionStatus): void;
  recordConnectionError(error: unknown): void;
  recordRetryScheduled(attempt: number, delayMs: number): void;
  recordInvalidEvent(): void;
}

export interface CreateStudyProcessingSSETelemetryOptions {
  maxEvents?: number;
  reportEvent?(event: StudyProcessingSSETelemetryEvent): void;
}

function safeHTTPStatus(error: unknown): 401 | 403 | 500 | 503 | null {
  if (!(error instanceof StudyProcessingSSEError)) {
    return null;
  }

  return error.status === 401 ||
    error.status === 403 ||
    error.status === 500 ||
    error.status === 503
    ? error.status
    : null;
}

export function getStudyProcessingSSEErrorCategory(
  error: unknown
): StudyProcessingSSEErrorCategory {
  const status = safeHTTPStatus(error);
  switch (status) {
    case 401:
      return 'authentication';
    case 403:
      return 'authorization';
    case 500:
      return 'server_error';
    case 503:
      return 'service_unavailable';
    default:
      return error instanceof TypeError ? 'network' : 'unknown';
  }
}

function defaultReportEvent(event: StudyProcessingSSETelemetryEvent): void {
  console.debug('[study-processing-sse]', event);
}

export function createStudyProcessingSSETelemetry({
  maxEvents = DEFAULT_STUDY_PROCESSING_SSE_TELEMETRY_LIMIT,
  reportEvent = defaultReportEvent,
}: CreateStudyProcessingSSETelemetryOptions = {}): StudyProcessingSSETelemetry {
  const eventLimit = Math.max(0, Math.floor(maxEvents));
  let eventCount = 0;

  function record(event: StudyProcessingSSETelemetryEvent): void {
    if (eventCount >= eventLimit) {
      return;
    }

    eventCount += 1;
    reportEvent(event);
  }

  return {
    recordConnectionState: state => record({ name: 'connection_state', state }),
    recordConnectionError: error =>
      record({
        name: 'connection_error',
        category: getStudyProcessingSSEErrorCategory(error),
        status: safeHTTPStatus(error),
      }),
    recordRetryScheduled: (attempt, delayMs) =>
      record({
        name: 'retry_scheduled',
        attempt: Math.min(20, Math.max(1, Math.floor(attempt))),
        delayMs: Math.min(30_000, Math.max(0, Math.round(delayMs))),
      }),
    recordInvalidEvent: () => record({ name: 'invalid_event' }),
  };
}

export const studyProcessingSSETelemetry = createStudyProcessingSSETelemetry();
