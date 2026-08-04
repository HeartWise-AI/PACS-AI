import type { StudyProcessingSummary } from './types';

export type InitialSnapshotStatus = 'idle' | 'loading' | 'ready' | 'error';
export type RealtimeConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded';

export interface StudyProcessingState {
  summariesByStudyInstanceUID: Record<string, StudyProcessingSummary>;
  bufferedSummariesByStudyInstanceUID: Record<string, StudyProcessingSummary>;
  initialSnapshotStatus: InitialSnapshotStatus;
  initialSnapshotError: string | null;
  realtimeConnectionStatus: RealtimeConnectionStatus;
  realtimeConnectionError: string | null;
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
      type: 'connection.connecting';
    }
  | {
      type: 'connection.connected';
    }
  | {
      type: 'connection.reconnecting';
      error: string | null;
    }
  | {
      type: 'connection.degraded';
      error: string;
    }
  | {
      type: 'connection.disconnected';
    }
  | {
      type: 'state.cleared';
    };

export const initialStudyProcessingState: StudyProcessingState = {
  summariesByStudyInstanceUID: {},
  bufferedSummariesByStudyInstanceUID: {},
  initialSnapshotStatus: 'idle',
  initialSnapshotError: null,
  realtimeConnectionStatus: 'disconnected',
  realtimeConnectionError: null,
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
    case 'connection.connecting':
      return {
        ...state,
        realtimeConnectionStatus: 'connecting',
        realtimeConnectionError: null,
      };
    case 'connection.connected':
      return {
        ...state,
        realtimeConnectionStatus: 'connected',
        realtimeConnectionError: null,
      };
    case 'connection.reconnecting':
      return {
        ...state,
        realtimeConnectionStatus: 'reconnecting',
        realtimeConnectionError: action.error,
      };
    case 'connection.degraded':
      return {
        ...state,
        realtimeConnectionStatus: 'degraded',
        realtimeConnectionError: action.error,
      };
    case 'connection.disconnected':
      return {
        ...state,
        realtimeConnectionStatus: 'disconnected',
        realtimeConnectionError: null,
      };
    case 'state.cleared':
      return initialStudyProcessingState;
    default:
      return state;
  }
}
