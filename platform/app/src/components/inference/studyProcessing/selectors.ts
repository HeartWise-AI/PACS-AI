import type { StudyProcessingSummary } from './types';
import type {
  InitialSnapshotStatus,
  RealtimeConnectionStatus,
  StudyProcessingState,
} from './reducer';

export function selectStudyProcessingSummary(
  state: StudyProcessingState,
  studyInstanceUID: string
): StudyProcessingSummary | undefined {
  return state.summariesByStudyInstanceUID[studyInstanceUID];
}

export function selectVisibleStudyProcessingSummaries(
  state: StudyProcessingState,
  visibleStudyInstanceUIDs: string[]
): Array<StudyProcessingSummary | undefined> {
  return visibleStudyInstanceUIDs.map(studyInstanceUID =>
    selectStudyProcessingSummary(state, studyInstanceUID)
  );
}

export function selectInitialSnapshotStatus(state: StudyProcessingState): InitialSnapshotStatus {
  return state.initialSnapshotStatus;
}

export function selectInitialSnapshotError(state: StudyProcessingState): string | null {
  return state.initialSnapshotError;
}

export function selectRealtimeConnectionStatus(
  state: StudyProcessingState
): RealtimeConnectionStatus {
  return state.realtimeConnectionStatus;
}

export function selectRealtimeConnectionError(state: StudyProcessingState): string | null {
  return state.realtimeConnectionError;
}

export function selectIsRealtimeDataStale(state: StudyProcessingState): boolean {
  const hasStudyData = Object.keys(state.summariesByStudyInstanceUID).length > 0;
  const hasRealtimeGap =
    state.realtimeConnectionStatus === 'reconnecting' ||
    state.realtimeConnectionStatus === 'degraded';

  return hasStudyData && hasRealtimeGap;
}
