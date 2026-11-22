import {
  createIdleStudyReprocessRequestEntry,
  initialStudyReprocessRequestState,
  studyReprocessRequestReducer,
} from './reprocessReducer';

const createdRun = {
  id: 'run-2',
  runNumber: 2,
  trigger: 'MANUAL_REPROCESS' as const,
  phase: 'QUEUED' as const,
  expectedModels: 3,
};

describe('studyReprocessRequestReducer', () => {
  it('tracks submission and success independently by Study Instance UID', () => {
    const submitting = studyReprocessRequestReducer(initialStudyReprocessRequestState, {
      type: 'reprocess.started',
      studyInstanceUID: 'study-a',
    });
    const succeeded = studyReprocessRequestReducer(submitting, {
      type: 'reprocess.succeeded',
      studyInstanceUID: 'study-a',
      createdRun,
    });

    expect(succeeded.entriesByStudyInstanceUID['study-a']).toEqual({
      status: 'success',
      createdRun,
      error: null,
    });
    expect(succeeded.entriesByStudyInstanceUID['study-b']).toBeUndefined();
  });

  it('keeps existing data visible when a later request fails', () => {
    const previous = {
      entriesByStudyInstanceUID: {
        'study-a': { status: 'success' as const, createdRun, error: null },
      },
    };
    const error = new Error('conflict');

    const failed = studyReprocessRequestReducer(previous, {
      type: 'reprocess.failed',
      studyInstanceUID: 'study-a',
      error,
    });

    expect(failed.entriesByStudyInstanceUID['study-a']).toEqual({
      status: 'error',
      createdRun,
      error,
    });
  });

  it('dismisses one result and clears every request on an auth lifecycle change', () => {
    const populated = studyReprocessRequestReducer(initialStudyReprocessRequestState, {
      type: 'reprocess.started',
      studyInstanceUID: 'study-a',
    });
    const dismissed = studyReprocessRequestReducer(populated, {
      type: 'reprocess.dismissed',
      studyInstanceUID: 'study-a',
    });

    expect(dismissed.entriesByStudyInstanceUID['study-a']).toBeUndefined();
    expect(studyReprocessRequestReducer(populated, { type: 'reprocess.stateCleared' })).toEqual(
      initialStudyReprocessRequestState
    );
    expect(createIdleStudyReprocessRequestEntry().status).toBe('idle');
  });
});
