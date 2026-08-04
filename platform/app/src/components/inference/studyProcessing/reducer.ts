import type { StudyProcessingSummary } from './types';

export interface StudyProcessingState {
  summariesByStudyInstanceUID: Record<string, StudyProcessingSummary>;
}

export type StudyProcessingAction =
  | {
      type: 'snapshot.received';
      summaries: StudyProcessingSummary[];
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

function mergeSummaries(
  state: StudyProcessingState,
  incomingSummaries: StudyProcessingSummary[]
): StudyProcessingState {
  let summariesByStudyInstanceUID = state.summariesByStudyInstanceUID;

  incomingSummaries.forEach(incoming => {
    const current = summariesByStudyInstanceUID[incoming.studyInstanceUID];

    if (!shouldApplyStudyProcessingSummary(current, incoming)) {
      return;
    }

    if (summariesByStudyInstanceUID === state.summariesByStudyInstanceUID) {
      summariesByStudyInstanceUID = { ...state.summariesByStudyInstanceUID };
    }

    summariesByStudyInstanceUID[incoming.studyInstanceUID] = incoming;
  });

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
    case 'snapshot.received':
      return mergeSummaries(state, action.summaries);
    case 'status.updated':
      return mergeSummaries(state, [action.summary]);
    case 'state.cleared':
      return initialStudyProcessingState;
    default:
      return state;
  }
}
