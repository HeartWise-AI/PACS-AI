import type { StudyProcessingSummary } from './types';

export type InitialSnapshotStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface StudyProcessingState {
  summariesByStudyInstanceUID: Record<string, StudyProcessingSummary>;
  bufferedSummariesByStudyInstanceUID: Record<string, StudyProcessingSummary>;
  initialSnapshotStatus: InitialSnapshotStatus;
  initialSnapshotError: string | null;
}

export type StudyProcessingAction =
  | {
      type: 'initialSnapshot.started';
    }
  | {
      type: 'snapshot.received';
      summaries: StudyProcessingSummary[];
    }
  | {
      type: 'initialSnapshot.failed';
      error: string;
    }
  | {
      type: 'status.updated';
      summary: StudyProcessingSummary;
    }
  | {
      type: 'state.cleared';
    };

export const initialStudyProcessingState: StudyProcessingState = {
  summariesByStudyInstanceUID: {},
  bufferedSummariesByStudyInstanceUID: {},
  initialSnapshotStatus: 'idle',
  initialSnapshotError: null,
};

export function shouldApplyStudyProcessingSummary(
  current: StudyProcessingSummary | undefined,
  incoming: StudyProcessingSummary
): boolean {
  if (current === undefined) {
    return true;
  }

  const currentRunNumber = current.runNumber ?? 0;
  const incomingRunNumber = incoming.runNumber ?? 0;

  if (incomingRunNumber !== currentRunNumber) {
    return incomingRunNumber > currentRunNumber;
  }

  return incoming.version > current.version;
}

function mergeSummaryRecords(
  currentSummaries: Record<string, StudyProcessingSummary>,
  incomingSummaries: StudyProcessingSummary[]
): Record<string, StudyProcessingSummary> {
  let nextSummaries = currentSummaries;

  incomingSummaries.forEach(incoming => {
    const current = nextSummaries[incoming.studyInstanceUID];

    if (!shouldApplyStudyProcessingSummary(current, incoming)) {
      return;
    }

    if (nextSummaries === currentSummaries) {
      nextSummaries = { ...currentSummaries };
    }

    nextSummaries[incoming.studyInstanceUID] = incoming;
  });

  return nextSummaries;
}

function mergeSummaries(
  state: StudyProcessingState,
  incomingSummaries: StudyProcessingSummary[]
): StudyProcessingState {
  const summariesByStudyInstanceUID = mergeSummaryRecords(
    state.summariesByStudyInstanceUID,
    incomingSummaries
  );

  if (summariesByStudyInstanceUID === state.summariesByStudyInstanceUID) {
    return state;
  }

  return {
    ...state,
    summariesByStudyInstanceUID,
  };
}

export function studyProcessingReducer(
  state: StudyProcessingState,
  action: StudyProcessingAction
): StudyProcessingState {
  switch (action.type) {
    case 'initialSnapshot.started':
      if (state.initialSnapshotStatus === 'loading') {
        return state;
      }

      return {
        ...state,
        bufferedSummariesByStudyInstanceUID: {},
        initialSnapshotStatus: 'loading',
        initialSnapshotError: null,
      };
    case 'snapshot.received': {
      const snapshotSummaries = mergeSummaryRecords(
        state.summariesByStudyInstanceUID,
        action.summaries
      );
      const summariesWithBufferedUpdates = mergeSummaryRecords(
        snapshotSummaries,
        Object.values(state.bufferedSummariesByStudyInstanceUID)
      );

      return {
        ...state,
        summariesByStudyInstanceUID: summariesWithBufferedUpdates,
        bufferedSummariesByStudyInstanceUID: {},
        initialSnapshotStatus: 'ready',
        initialSnapshotError: null,
      };
    }
    case 'initialSnapshot.failed': {
      const summariesWithBufferedUpdates = mergeSummaryRecords(
        state.summariesByStudyInstanceUID,
        Object.values(state.bufferedSummariesByStudyInstanceUID)
      );

      return {
        ...state,
        summariesByStudyInstanceUID: summariesWithBufferedUpdates,
        bufferedSummariesByStudyInstanceUID: {},
        initialSnapshotStatus: 'error',
        initialSnapshotError: action.error,
      };
    }
    case 'status.updated':
      if (state.initialSnapshotStatus === 'loading') {
        const bufferedSummariesByStudyInstanceUID = mergeSummaryRecords(
          state.bufferedSummariesByStudyInstanceUID,
          [action.summary]
        );

        if (bufferedSummariesByStudyInstanceUID === state.bufferedSummariesByStudyInstanceUID) {
          return state;
        }

        return {
          ...state,
          bufferedSummariesByStudyInstanceUID,
        };
      }

      return mergeSummaries(state, [action.summary]);
    case 'state.cleared':
      return initialStudyProcessingState;
    default:
      return state;
  }
}
