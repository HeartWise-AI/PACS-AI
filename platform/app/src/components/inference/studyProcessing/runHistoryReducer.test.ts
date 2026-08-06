import { studyProcessingRunHistoryFixture } from './fixtures';
import {
  createIdleRunHistoryEntry,
  initialRunHistoryState,
  runHistoryReducer,
} from './runHistoryReducer';

const studyInstanceUID = studyProcessingRunHistoryFixture.studyInstanceUID;

describe('runHistoryReducer', () => {
  test('starts loading history for only the requested study', () => {
    const state = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.loadStarted',
      studyInstanceUID,
    });

    expect(state.entriesByStudyInstanceUID[studyInstanceUID]).toEqual({
      status: 'loading',
      history: null,
      error: null,
      retryable: true,
    });
    expect(state.entriesByStudyInstanceUID['another-study']).toBeUndefined();
  });

  test('stores completed history by Study Instance UID', () => {
    const state = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.received',
      history: studyProcessingRunHistoryFixture,
    });

    expect(state.entriesByStudyInstanceUID[studyInstanceUID]).toEqual({
      status: 'ready',
      history: studyProcessingRunHistoryFixture,
      error: null,
      retryable: true,
    });
  });

  test('marks incomplete history as partial', () => {
    const state = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.received',
      history: studyProcessingRunHistoryFixture,
      partial: true,
    });

    expect(state.entriesByStudyInstanceUID[studyInstanceUID].status).toBe('partial');
  });

  test('keeps cached history visible while refreshing', () => {
    const readyState = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.received',
      history: studyProcessingRunHistoryFixture,
    });

    const refreshingState = runHistoryReducer(readyState, {
      type: 'runHistory.loadStarted',
      studyInstanceUID,
    });

    expect(refreshingState.entriesByStudyInstanceUID[studyInstanceUID]).toEqual({
      status: 'refreshing',
      history: studyProcessingRunHistoryFixture,
      error: null,
      retryable: true,
    });
  });

  test('keeps cached history when a refresh fails', () => {
    const readyState = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.received',
      history: studyProcessingRunHistoryFixture,
    });

    const errorState = runHistoryReducer(readyState, {
      type: 'runHistory.failed',
      studyInstanceUID,
      error: 'Unable to refresh run history.',
    });

    expect(errorState.entriesByStudyInstanceUID[studyInstanceUID]).toEqual({
      status: 'error',
      history: studyProcessingRunHistoryFixture,
      error: 'Unable to refresh run history.',
      retryable: true,
    });
  });

  test('represents unavailable history without inventing data', () => {
    const state = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.unavailable',
      studyInstanceUID,
      error: 'Run history service is unavailable.',
    });

    expect(state.entriesByStudyInstanceUID[studyInstanceUID]).toEqual({
      status: 'unavailable',
      history: null,
      error: 'Run history service is unavailable.',
      retryable: true,
    });
  });

  test('clears one study without changing another cached study', () => {
    const firstHistory = studyProcessingRunHistoryFixture;
    const secondHistory = {
      ...studyProcessingRunHistoryFixture,
      studyInstanceUID: 'another-study',
    };
    const firstState = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.received',
      history: firstHistory,
    });
    const populatedState = runHistoryReducer(firstState, {
      type: 'runHistory.received',
      history: secondHistory,
    });

    const clearedState = runHistoryReducer(populatedState, {
      type: 'runHistory.cleared',
      studyInstanceUID,
    });

    expect(clearedState.entriesByStudyInstanceUID[studyInstanceUID]).toBeUndefined();
    expect(clearedState.entriesByStudyInstanceUID['another-study'].history).toBe(secondHistory);
  });

  test('clears all history for tenant or session changes', () => {
    const populatedState = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.received',
      history: studyProcessingRunHistoryFixture,
    });

    expect(
      runHistoryReducer(populatedState, {
        type: 'runHistory.stateCleared',
      })
    ).toBe(initialRunHistoryState);
    expect(createIdleRunHistoryEntry()).toEqual({
      status: 'idle',
      history: null,
      error: null,
      retryable: true,
    });
  });

  test('marks authorization failures as non-retryable', () => {
    const state = runHistoryReducer(initialRunHistoryState, {
      type: 'runHistory.unavailable',
      studyInstanceUID,
      error: 'Authentication is required.',
      retryable: false,
    });

    expect(state.entriesByStudyInstanceUID[studyInstanceUID]).toMatchObject({
      status: 'unavailable',
      retryable: false,
    });
  });
});
