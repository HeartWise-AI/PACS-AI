import type { StudyProcessingRunHistory } from './types';

export type RunHistoryLoadStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'refreshing'
  | 'partial'
  | 'error'
  | 'unavailable';

export interface RunHistoryEntry {
  status: RunHistoryLoadStatus;
  history: StudyProcessingRunHistory | null;
  error: string | null;
}

export interface RunHistoryState {
  entriesByStudyInstanceUID: Record<string, RunHistoryEntry>;
}

export type RunHistoryAction =
  | {
      type: 'runHistory.loadStarted';
      studyInstanceUID: string;
    }
  | {
      type: 'runHistory.received';
      history: StudyProcessingRunHistory;
      partial?: boolean;
    }
  | {
      type: 'runHistory.failed';
      studyInstanceUID: string;
      error: string;
    }
  | {
      type: 'runHistory.unavailable';
      studyInstanceUID: string;
      error: string;
    }
  | {
      type: 'runHistory.cleared';
      studyInstanceUID: string;
    }
  | {
      type: 'runHistory.stateCleared';
    };

export const initialRunHistoryState: RunHistoryState = {
  entriesByStudyInstanceUID: {},
};

export function createIdleRunHistoryEntry(): RunHistoryEntry {
  return {
    status: 'idle',
    history: null,
    error: null,
  };
}

function updateEntry(
  state: RunHistoryState,
  studyInstanceUID: string,
  entry: RunHistoryEntry
): RunHistoryState {
  return {
    ...state,
    entriesByStudyInstanceUID: {
      ...state.entriesByStudyInstanceUID,
      [studyInstanceUID]: entry,
    },
  };
}

export function runHistoryReducer(
  state: RunHistoryState,
  action: RunHistoryAction
): RunHistoryState {
  switch (action.type) {
    case 'runHistory.loadStarted': {
      const current = state.entriesByStudyInstanceUID[action.studyInstanceUID];

      if (current?.status === 'loading' || current?.status === 'refreshing') {
        return state;
      }

      return updateEntry(state, action.studyInstanceUID, {
        status: current?.history ? 'refreshing' : 'loading',
        history: current?.history ?? null,
        error: null,
      });
    }
    case 'runHistory.received':
      return updateEntry(state, action.history.studyInstanceUID, {
        status: action.partial ? 'partial' : 'ready',
        history: action.history,
        error: null,
      });
    case 'runHistory.failed': {
      const current = state.entriesByStudyInstanceUID[action.studyInstanceUID];

      return updateEntry(state, action.studyInstanceUID, {
        status: 'error',
        history: current?.history ?? null,
        error: action.error,
      });
    }
    case 'runHistory.unavailable': {
      const current = state.entriesByStudyInstanceUID[action.studyInstanceUID];

      return updateEntry(state, action.studyInstanceUID, {
        status: 'unavailable',
        history: current?.history ?? null,
        error: action.error,
      });
    }
    case 'runHistory.cleared': {
      if (!state.entriesByStudyInstanceUID[action.studyInstanceUID]) {
        return state;
      }

      const entriesByStudyInstanceUID = { ...state.entriesByStudyInstanceUID };
      delete entriesByStudyInstanceUID[action.studyInstanceUID];

      return {
        ...state,
        entriesByStudyInstanceUID,
      };
    }
    case 'runHistory.stateCleared':
      return initialRunHistoryState;
    default:
      return state;
  }
}
