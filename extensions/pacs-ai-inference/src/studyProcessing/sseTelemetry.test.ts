import {
  createStudyProcessingSSETelemetry,
  getStudyProcessingSSEErrorCategory,
  type StudyProcessingSSETelemetryEvent,
} from './sseTelemetry';
import { StudyProcessingSSEError } from './sseTransport';

describe('study processing SSE telemetry', () => {
  test.each([
    [new StudyProcessingSSEError('secret response', 401), 'authentication'],
    [new StudyProcessingSSEError('secret response', 403), 'authorization'],
    [new StudyProcessingSSEError('secret response', 500), 'server_error'],
    [new StudyProcessingSSEError('secret response', 503), 'service_unavailable'],
    [new TypeError('secret network details'), 'network'],
    [new Error('secret unknown details'), 'unknown'],
  ])('maps errors to safe categories', (error, expectedCategory) => {
    expect(getStudyProcessingSSEErrorCategory(error)).toBe(expectedCategory);
  });

  test('reports only allowlisted bounded metadata', () => {
    const events: StudyProcessingSSETelemetryEvent[] = [];
    const telemetry = createStudyProcessingSSETelemetry({
      reportEvent: event => events.push(event),
    });
    const sensitiveError = new StudyProcessingSSEError(
      'Bearer secret-token tenant-123 patient-456 1.2.840.113619',
      503
    );

    telemetry.recordConnectionState('reconnecting');
    telemetry.recordRetryScheduled(99, 999_999);
    telemetry.recordConnectionError(sensitiveError);
    telemetry.recordInvalidEvent();

    expect(events).toEqual([
      { name: 'connection_state', state: 'reconnecting' },
      { name: 'retry_scheduled', attempt: 20, delayMs: 30_000 },
      { name: 'connection_error', category: 'service_unavailable', status: 503 },
      { name: 'invalid_event' },
    ]);
    expect(JSON.stringify(events)).not.toMatch(
      /secret-token|tenant-123|patient-456|1\.2\.840\.113619/
    );
  });

  test('stops reporting after the configured per-session event limit', () => {
    const reportEvent = jest.fn();
    const telemetry = createStudyProcessingSSETelemetry({ maxEvents: 2, reportEvent });

    telemetry.recordConnectionState('connecting');
    telemetry.recordConnectionState('connected');
    telemetry.recordConnectionState('reconnecting');

    expect(reportEvent).toHaveBeenCalledTimes(2);
  });
});
