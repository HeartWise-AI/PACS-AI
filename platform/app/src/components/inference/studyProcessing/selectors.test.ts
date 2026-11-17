import { studyProcessingSnapshotFixture, studyProcessingSummaryFixtures } from './fixtures';
import { initialStudyProcessingState, studyProcessingReducer } from './reducer';
import {
  selectInitialSnapshotError,
  selectInitialSnapshotRetryable,
  selectInitialSnapshotStatus,
  selectIsRealtimeDataStale,
  selectRealtimeConnectionError,
  selectRealtimeConnectionStatus,
  selectStudyProcessingSummary,
  selectVisibleStudyProcessingSummaries,
} from './selectors';

const readyState = studyProcessingReducer(initialStudyProcessingState, {
  type: 'snapshot.received',
  summaries: studyProcessingSnapshotFixture.items,
});

describe('study processing selectors', () => {
  test('selects a summary by Study Instance UID', () => {
    const summary = selectStudyProcessingSummary(
      readyState,
      studyProcessingSummaryFixtures.processing.studyInstanceUID
    );

    expect(summary).toBe(studyProcessingSummaryFixtures.processing);
  });

  test('returns undefined when a study has no processing summary', () => {
    expect(selectStudyProcessingSummary(readyState, '1.2.840.missing')).toBeUndefined();
  });

  test('preserves visible worklist order and missing positions', () => {
    const visibleStudyInstanceUIDs = [
      studyProcessingSummaryFixtures.success.studyInstanceUID,
      '1.2.840.missing',
      studyProcessingSummaryFixtures.processing.studyInstanceUID,
    ];

    expect(selectVisibleStudyProcessingSummaries(readyState, visibleStudyInstanceUIDs)).toEqual([
      studyProcessingSummaryFixtures.success,
      undefined,
      studyProcessingSummaryFixtures.processing,
    ]);
  });

  test('selects snapshot status and error without exposing state structure', () => {
    const loadingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'initialSnapshot.started',
    });
    const errorState = studyProcessingReducer(loadingState, {
      type: 'initialSnapshot.failed',
      error: 'Snapshot unavailable.',
      retryable: false,
    });

    expect(selectInitialSnapshotStatus(errorState)).toBe('error');
    expect(selectInitialSnapshotError(errorState)).toBe('Snapshot unavailable.');
    expect(selectInitialSnapshotRetryable(errorState)).toBe(false);
  });

  test('selects connection status and error', () => {
    const degradedState = studyProcessingReducer(readyState, {
      type: 'connection.degraded',
      error: 'Real-time updates unavailable.',
    });

    expect(selectRealtimeConnectionStatus(degradedState)).toBe('degraded');
    expect(selectRealtimeConnectionError(degradedState)).toBe('Real-time updates unavailable.');
  });

  test('derives stale state only when existing data has a real-time gap', () => {
    const emptyReconnectingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'connection.reconnecting',
      error: null,
    });
    const readyReconnectingState = studyProcessingReducer(readyState, {
      type: 'connection.reconnecting',
      error: null,
    });

    expect(selectIsRealtimeDataStale(emptyReconnectingState)).toBe(false);
    expect(selectIsRealtimeDataStale(readyReconnectingState)).toBe(true);
  });
});
