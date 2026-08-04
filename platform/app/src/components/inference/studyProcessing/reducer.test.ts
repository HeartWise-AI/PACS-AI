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
    const staleProcessing = { ...processing, version: processing.version - 1 };
    const newerSuccess = { ...success, version: success.version + 1 };

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

  test('rejects equal and older versions', () => {
    const current = studyStatusUpdatedEventFixture;

    expect(shouldApplyStudyProcessingSummary(current, { ...current })).toBe(false);
    expect(
      shouldApplyStudyProcessingSummary(current, { ...current, version: current.version - 1 })
    ).toBe(false);
  });
});
