import { RunHistoryUnavailableError } from './runHistoryTransport';
import { StudyProcessingRESTError } from './restRepository';

export const DEFAULT_STUDY_PROCESSING_ROLLOUT_TELEMETRY_LIMIT = 100;

export type StudyProcessingRESTFailureCategory =
  | 'authentication'
  | 'authorization'
  | 'bad_request'
  | 'network'
  | 'not_found'
  | 'server_error'
  | 'service_unavailable'
  | 'unknown';

export type StudyProcessingRolloutTelemetryEvent =
  | {
      name: 'snapshot_failure';
      category: StudyProcessingRESTFailureCategory;
      status: 400 | 401 | 403 | 404 | 500 | 503 | null;
    }
  | {
      name: 'run_history_failure';
      category: 'authorization' | 'unavailable' | 'unknown';
      retryable: boolean;
    }
  | {
      name: 'candidate_fallback_activated';
      reason: 'live_notifications_disabled' | 'realtime_unavailable';
    };

export interface StudyProcessingRolloutTelemetry {
  recordSnapshotFailure(error: unknown): void;
  recordRunHistoryFailure(error: unknown): void;
  recordCandidateFallbackActivation(
    reason: 'live_notifications_disabled' | 'realtime_unavailable'
  ): void;
}

export interface CreateStudyProcessingRolloutTelemetryOptions {
  maxEvents?: number;
  reportEvent?(event: StudyProcessingRolloutTelemetryEvent): void;
}

function safeRESTStatus(error: unknown): 400 | 401 | 403 | 404 | 500 | 503 | null {
  if (!(error instanceof StudyProcessingRESTError)) {
    return null;
  }

  return error.status === 400 ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    error.status === 500 ||
    error.status === 503
    ? error.status
    : null;
}

export function getStudyProcessingRESTFailureCategory(
  error: unknown
): StudyProcessingRESTFailureCategory {
  switch (safeRESTStatus(error)) {
    case 400:
      return 'bad_request';
    case 401:
      return 'authentication';
    case 403:
      return 'authorization';
    case 404:
      return 'not_found';
    case 500:
      return 'server_error';
    case 503:
      return 'service_unavailable';
    default:
      return error instanceof TypeError ? 'network' : 'unknown';
  }
}

function runHistoryFailure(error: unknown): {
  category: 'authorization' | 'unavailable' | 'unknown';
  retryable: boolean;
} {
  if (!(error instanceof RunHistoryUnavailableError)) {
    return { category: 'unknown', retryable: true };
  }

  return {
    category: error.retryable ? 'unavailable' : 'authorization',
    retryable: error.retryable,
  };
}

function defaultReportEvent(event: StudyProcessingRolloutTelemetryEvent): void {
  console.debug('[study-processing-rollout]', event);
}

export function createStudyProcessingRolloutTelemetry({
  maxEvents = DEFAULT_STUDY_PROCESSING_ROLLOUT_TELEMETRY_LIMIT,
  reportEvent = defaultReportEvent,
}: CreateStudyProcessingRolloutTelemetryOptions = {}): StudyProcessingRolloutTelemetry {
  const eventLimit = Math.max(0, Math.floor(maxEvents));
  let eventCount = 0;

  function record(event: StudyProcessingRolloutTelemetryEvent): void {
    if (eventCount >= eventLimit) {
      return;
    }

    eventCount += 1;
    reportEvent(event);
  }

  return {
    recordSnapshotFailure: error =>
      record({
        name: 'snapshot_failure',
        category: getStudyProcessingRESTFailureCategory(error),
        status: safeRESTStatus(error),
      }),
    recordRunHistoryFailure: error =>
      record({ name: 'run_history_failure', ...runHistoryFailure(error) }),
    recordCandidateFallbackActivation: reason =>
      record({ name: 'candidate_fallback_activated', reason }),
  };
}

export const studyProcessingRolloutTelemetry = createStudyProcessingRolloutTelemetry();
