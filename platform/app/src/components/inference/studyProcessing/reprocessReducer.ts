import type { CreatedStudyProcessingRun } from './types';

export type StudyReprocessRequestStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface StudyReprocessRequestEntry {
  status: StudyReprocessRequestStatus;
  createdRun: CreatedStudyProcessingRun | null;
  error: Error | null;
}

export interface StudyReprocessRequestState {
  entriesByStudyInstanceUID: Record<string, StudyReprocessRequestEntry>;
}

export type StudyReprocessRequestAction =
  | { type: 'reprocess.started'; studyInstanceUID: string }
  | {
      type: 'reprocess.succeeded';
      studyInstanceUID: string;
      createdRun: CreatedStudyProcessingRun;
    }
  | { type: 'reprocess.failed'; studyInstanceUID: string; error: Error }
  | { type: 'reprocess.dismissed'; studyInstanceUID: string }
  | { type: 'reprocess.stateCleared' };

export const initialStudyReprocessRequestState: StudyReprocessRequestState = {
  entriesByStudyInstanceUID: {},
};

export function createIdleStudyReprocessRequestEntry(): StudyReprocessRequestEntry {
  return {
    status: 'idle',
    createdRun: null,
    error: null,
  };
}

export function studyReprocessRequestReducer(
  state: StudyReprocessRequestState,
  action: StudyReprocessRequestAction
): StudyReprocessRequestState {
  if (action.type === 'reprocess.stateCleared') {
    return initialStudyReprocessRequestState;
  }

  if (action.type === 'reprocess.dismissed') {
    const entriesByStudyInstanceUID = { ...state.entriesByStudyInstanceUID };
    delete entriesByStudyInstanceUID[action.studyInstanceUID];
    return { entriesByStudyInstanceUID };
  }

  const currentEntry =
    state.entriesByStudyInstanceUID[action.studyInstanceUID] ??
    createIdleStudyReprocessRequestEntry();

  const nextEntry: StudyReprocessRequestEntry =
    action.type === 'reprocess.started'
      ? { status: 'submitting', createdRun: null, error: null }
      : action.type === 'reprocess.succeeded'
        ? { status: 'success', createdRun: action.createdRun, error: null }
        : { status: 'error', createdRun: currentEntry.createdRun, error: action.error };

  return {
    entriesByStudyInstanceUID: {
      ...state.entriesByStudyInstanceUID,
      [action.studyInstanceUID]: nextEntry,
    },
  };
}
