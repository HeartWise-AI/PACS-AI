import { RunHistoryUnavailableError } from './runHistoryTransport';
import { StudyProcessingRESTError } from './restRepository';
import {
  createStudyProcessingRolloutTelemetry,
  getStudyProcessingRESTFailureCategory,
  type StudyProcessingRolloutTelemetryEvent,
} from './rolloutTelemetry';

describe('study processing rollout telemetry', () => {
  test.each([
    [400, 'bad_request'],
    [401, 'authentication'],
    [403, 'authorization'],
    [404, 'not_found'],
    [500, 'server_error'],
    [503, 'service_unavailable'],
  ] as const)('maps REST status %i to %s', (status, category) => {
    expect(
      getStudyProcessingRESTFailureCategory(
        new StudyProcessingRESTError('private backend message', status)
      )
    ).toBe(category);
  });

  test('emits bounded identifier-free rollout categories', () => {
    const events: StudyProcessingRolloutTelemetryEvent[] = [];
    const telemetry = createStudyProcessingRolloutTelemetry({
      maxEvents: 3,
      reportEvent: event => events.push(event),
    });

    telemetry.recordSnapshotFailure(
      new StudyProcessingRESTError('tenant=secret study=1.2.840 patient=private token=private', 503)
    );
    telemetry.recordRunHistoryFailure(
      new RunHistoryUnavailableError('study=1.2.840 private history', false)
    );
    telemetry.recordCandidateFallbackActivation('realtime_unavailable');
    telemetry.recordSnapshotFailure(new TypeError('private network detail'));

    expect(events).toEqual([
      {
        name: 'snapshot_failure',
        category: 'service_unavailable',
        status: 503,
      },
      {
        name: 'run_history_failure',
        category: 'authorization',
        retryable: false,
      },
      {
        name: 'candidate_fallback_activated',
        reason: 'realtime_unavailable',
      },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/tenant|1\.2\.840|patient|token|private/);
  });

  test('distinguishes retryable history unavailability from unknown failures', () => {
    const events: StudyProcessingRolloutTelemetryEvent[] = [];
    const telemetry = createStudyProcessingRolloutTelemetry({
      reportEvent: event => events.push(event),
    });

    telemetry.recordRunHistoryFailure(new RunHistoryUnavailableError('Unavailable.', true));
    telemetry.recordRunHistoryFailure(new Error('Unexpected.'));

    expect(events).toEqual([
      {
        name: 'run_history_failure',
        category: 'unavailable',
        retryable: true,
      },
      {
        name: 'run_history_failure',
        category: 'unknown',
        retryable: true,
      },
    ]);
  });
});
