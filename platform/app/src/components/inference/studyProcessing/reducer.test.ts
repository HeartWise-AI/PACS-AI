import {
  studyProcessingSnapshotFixture,
  studyProcessingSummaryFixtures,
  studyStatusUpdatedEventFixture,
} from './fixtures';
import {
  initialStudyProcessingState,
  shouldApplyStudyProcessingSummary,
  studyProcessingReducer,
} from './reducer';
import { selectIsRealtimeDataStale } from './selectors';

describe('studyProcessingReducer', () => {
  test('merges snapshot summaries by Study Instance UID', () => {
    const state = studyProcessingReducer(initialStudyProcessingState, {
      type: 'snapshot.received',
      summaries: studyProcessingSnapshotFixture.items,
    });

    expect(Object.keys(state.summariesByStudyInstanceUID)).toHaveLength(
      studyProcessingSnapshotFixture.totalItems
    );
    expect(
      state.summariesByStudyInstanceUID[
        studyProcessingSummaryFixtures.partialSuccess.studyInstanceUID
      ]
    ).toBe(studyProcessingSummaryFixtures.partialSuccess);
  });

  test('applies an event with a newer study version', () => {
    const initialState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'status.updated',
      summary: studyProcessingSummaryFixtures.processing,
    });

    const nextState = studyProcessingReducer(initialState, {
      type: 'status.updated',
      summary: studyStatusUpdatedEventFixture,
    });

    expect(
      nextState.summariesByStudyInstanceUID[studyStatusUpdatedEventFixture.studyInstanceUID]
    ).toBe(studyStatusUpdatedEventFixture);
  });

  test('ignores duplicate and older versions without changing state identity', () => {
    const current = studyStatusUpdatedEventFixture;
    const state = studyProcessingReducer(initialStudyProcessingState, {
      type: 'status.updated',
      summary: current,
    });
    const duplicate = { ...current };
    const older = { ...current, version: current.version - 1 };

    const afterDuplicate = studyProcessingReducer(state, {
      type: 'status.updated',
      summary: duplicate,
    });
    const afterOlder = studyProcessingReducer(afterDuplicate, {
      type: 'status.updated',
      summary: older,
    });

    expect(afterDuplicate).toBe(state);
    expect(afterOlder).toBe(state);
    expect(afterOlder.summariesByStudyInstanceUID[current.studyInstanceUID]).toBe(current);
  });

  test('merges only newer records from a mixed-version snapshot', () => {
    const processing = studyProcessingSummaryFixtures.processing;
    const success = studyProcessingSummaryFixtures.success;
    const state = studyProcessingReducer(initialStudyProcessingState, {
      type: 'snapshot.received',
      summaries: [processing, success],
    });
    const staleProcessing = { ...processing, version: (processing.version ?? 0) - 1 };
    const newerSuccess = { ...success, version: (success.version ?? 0) + 1 };

    const nextState = studyProcessingReducer(state, {
      type: 'snapshot.received',
      summaries: [staleProcessing, newerSuccess],
    });

    expect(nextState.summariesByStudyInstanceUID[processing.studyInstanceUID]).toBe(processing);
    expect(nextState.summariesByStudyInstanceUID[success.studyInstanceUID]).toBe(newerSuccess);
  });

  test('clears all study state for logout or tenant changes', () => {
    const populatedState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'snapshot.received',
      summaries: studyProcessingSnapshotFixture.items,
    });

    const clearedState = studyProcessingReducer(populatedState, {
      type: 'state.cleared',
    });

    expect(clearedState).toBe(initialStudyProcessingState);
    expect(clearedState.summariesByStudyInstanceUID).toEqual({});
  });

  test('buffers an event while the initial snapshot is loading', () => {
    const loadingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'initialSnapshot.started',
    });

    const bufferedState = studyProcessingReducer(loadingState, {
      type: 'status.updated',
      summary: studyStatusUpdatedEventFixture,
    });

    expect(bufferedState.initialSnapshotStatus).toBe('loading');
    expect(bufferedState.summariesByStudyInstanceUID).toEqual({});
    expect(
      bufferedState.bufferedSummariesByStudyInstanceUID[
        studyStatusUpdatedEventFixture.studyInstanceUID
      ]
    ).toBe(studyStatusUpdatedEventFixture);
  });

  test('does not discard buffered events when loading is started twice', () => {
    const loadingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'initialSnapshot.started',
    });
    const bufferedState = studyProcessingReducer(loadingState, {
      type: 'status.updated',
      summary: studyStatusUpdatedEventFixture,
    });

    const repeatedStartState = studyProcessingReducer(bufferedState, {
      type: 'initialSnapshot.started',
    });

    expect(repeatedStartState).toBe(bufferedState);
  });

  test('applies buffered events after the initial snapshot', () => {
    const loadingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'initialSnapshot.started',
    });
    const bufferedState = studyProcessingReducer(loadingState, {
      type: 'status.updated',
      summary: studyStatusUpdatedEventFixture,
    });

    const readyState = studyProcessingReducer(bufferedState, {
      type: 'snapshot.received',
      summaries: studyProcessingSnapshotFixture.items,
    });

    expect(readyState.initialSnapshotStatus).toBe('ready');
    expect(readyState.bufferedSummariesByStudyInstanceUID).toEqual({});
    expect(
      readyState.summariesByStudyInstanceUID[studyStatusUpdatedEventFixture.studyInstanceUID]
    ).toBe(studyStatusUpdatedEventFixture);
  });

  test('keeps only the newest buffered event for each study', () => {
    const loadingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'initialSnapshot.started',
    });
    const newestEvent = {
      ...studyStatusUpdatedEventFixture,
      version: studyStatusUpdatedEventFixture.version + 1,
    };
    const withNewestEvent = studyProcessingReducer(loadingState, {
      type: 'status.updated',
      summary: newestEvent,
    });

    const afterOlderEvent = studyProcessingReducer(withNewestEvent, {
      type: 'status.updated',
      summary: studyStatusUpdatedEventFixture,
    });

    expect(afterOlderEvent).toBe(withNewestEvent);
    expect(afterOlderEvent.bufferedSummariesByStudyInstanceUID[newestEvent.studyInstanceUID]).toBe(
      newestEvent
    );
  });

  test('preserves buffered events when the initial snapshot fails', () => {
    const loadingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'initialSnapshot.started',
    });
    const bufferedState = studyProcessingReducer(loadingState, {
      type: 'status.updated',
      summary: studyStatusUpdatedEventFixture,
    });

    const errorState = studyProcessingReducer(bufferedState, {
      type: 'initialSnapshot.failed',
      error: 'Unable to load processing status.',
    });

    expect(errorState.initialSnapshotStatus).toBe('error');
    expect(errorState.initialSnapshotError).toBe('Unable to load processing status.');
    expect(errorState.bufferedSummariesByStudyInstanceUID).toEqual({});
    expect(
      errorState.summariesByStudyInstanceUID[studyStatusUpdatedEventFixture.studyInstanceUID]
    ).toBe(studyStatusUpdatedEventFixture);
  });

  test('tracks the real-time connection lifecycle independently from study data', () => {
    const connectingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'connection.connecting',
    });
    const connectedState = studyProcessingReducer(connectingState, {
      type: 'connection.connected',
    });

    expect(connectingState.realtimeConnectionStatus).toBe('connecting');
    expect(connectedState.realtimeConnectionStatus).toBe('connected');
    expect(connectedState.realtimeConnectionError).toBeNull();
    expect(connectedState.summariesByStudyInstanceUID).toBe(
      initialStudyProcessingState.summariesByStudyInstanceUID
    );
  });

  test('keeps study data visible while the connection is reconnecting', () => {
    const readyState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'snapshot.received',
      summaries: studyProcessingSnapshotFixture.items,
    });
    const reconnectingState = studyProcessingReducer(readyState, {
      type: 'connection.reconnecting',
      error: 'Connection interrupted.',
    });

    expect(reconnectingState.realtimeConnectionStatus).toBe('reconnecting');
    expect(reconnectingState.realtimeConnectionError).toBe('Connection interrupted.');
    expect(reconnectingState.summariesByStudyInstanceUID).toBe(
      readyState.summariesByStudyInstanceUID
    );
    expect(selectIsRealtimeDataStale(reconnectingState)).toBe(true);
  });

  test('marks existing data stale when real-time updates are degraded', () => {
    const readyState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'snapshot.received',
      summaries: studyProcessingSnapshotFixture.items,
    });
    const degradedState = studyProcessingReducer(readyState, {
      type: 'connection.degraded',
      error: 'Real-time updates are unavailable.',
    });

    expect(degradedState.realtimeConnectionStatus).toBe('degraded');
    expect(degradedState.realtimeConnectionError).toBe('Real-time updates are unavailable.');
    expect(selectIsRealtimeDataStale(degradedState)).toBe(true);

    const recoveredState = studyProcessingReducer(degradedState, {
      type: 'connection.connected',
    });

    expect(selectIsRealtimeDataStale(recoveredState)).toBe(false);
    expect(recoveredState.realtimeConnectionError).toBeNull();
  });

  test('does not mark empty state stale during a connection problem', () => {
    const reconnectingState = studyProcessingReducer(initialStudyProcessingState, {
      type: 'connection.reconnecting',
      error: null,
    });

    expect(selectIsRealtimeDataStale(reconnectingState)).toBe(false);
  });
});

describe('shouldApplyStudyProcessingSummary', () => {
  test('accepts a missing study or a strictly newer version in the same run', () => {
    const current = studyProcessingSummaryFixtures.processing;

    expect(shouldApplyStudyProcessingSummary(undefined, current)).toBe(true);
    expect(shouldApplyStudyProcessingSummary(current, studyStatusUpdatedEventFixture)).toBe(true);
  });

  test('accepts a newer run even when its version restarts at one', () => {
    const current = {
      ...studyProcessingSummaryFixtures.partialSuccess,
      runNumber: 2,
      version: 17,
    };
    const incoming = {
      ...current,
      runId: 'run-3',
      runNumber: 3,
      version: 1,
    };

    expect(shouldApplyStudyProcessingSummary(current, incoming)).toBe(true);
    expect(shouldApplyStudyProcessingSummary(incoming, current)).toBe(false);
  });

  test('accepts the first processing run after a pre-run lifecycle state', () => {
    const retrieving = studyProcessingSummaryFixtures.retrieving;
    const firstRun = {
      ...studyProcessingSummaryFixtures.queued,
      studyInstanceUID: retrieving.studyInstanceUID,
      runNumber: 1,
      version: 1,
    };

    expect(shouldApplyStudyProcessingSummary(retrieving, firstRun)).toBe(true);
  });

  test('advances retrieval-only state using its authoritative timestamp', () => {
    const current = {
      ...studyProcessingSummaryFixtures.retrieving,
      version: null,
      updatedAt: '2026-08-06T14:00:00Z',
    };
    const newer = {
      ...current,
      retrievalState: 'RUNNING',
      updatedAt: '2026-08-06T14:01:00Z',
    };
    const older = {
      ...current,
      retrievalState: 'PENDING',
      updatedAt: '2026-08-06T13:59:00Z',
    };

    expect(shouldApplyStudyProcessingSummary(current, newer)).toBe(true);
    expect(shouldApplyStudyProcessingSummary(newer, older)).toBe(false);
  });

  test('rejects equal and older versions', () => {
    const current = studyStatusUpdatedEventFixture;

    expect(shouldApplyStudyProcessingSummary(current, { ...current })).toBe(false);
    expect(
      shouldApplyStudyProcessingSummary(current, { ...current, version: current.version - 1 })
    ).toBe(false);
  });
});
