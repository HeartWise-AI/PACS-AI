import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import PropTypes from 'prop-types';
import type { StudyProcessingSummary } from './types';
import {
  initialStudyProcessingState,
  studyProcessingReducer,
  type InitialSnapshotStatus,
  type RealtimeConnectionStatus,
} from './reducer';
import {
  selectInitialSnapshotError,
  selectInitialSnapshotStatus,
  selectIsRealtimeDataStale,
  selectRealtimeConnectionError,
  selectRealtimeConnectionStatus,
  selectStudyProcessingSummary,
  selectVisibleStudyProcessingSummaries,
} from './selectors';

export interface StudyProcessingContextValue {
  getStudySummary: (studyInstanceUID: string) => StudyProcessingSummary | undefined;
  getVisibleSummaries: (
    visibleStudyInstanceUIDs: string[]
  ) => Array<StudyProcessingSummary | undefined>;
  initialSnapshotStatus: InitialSnapshotStatus;
  initialSnapshotError: string | null;
  realtimeConnectionStatus: RealtimeConnectionStatus;
  realtimeConnectionError: string | null;
  isRealtimeDataStale: boolean;
  startInitialSnapshot: () => void;
  receiveSnapshot: (summaries: StudyProcessingSummary[]) => void;
  failInitialSnapshot: (error: string) => void;
  applyStatusUpdate: (summary: StudyProcessingSummary) => void;
  markConnectionConnecting: () => void;
  markConnectionConnected: () => void;
  markConnectionReconnecting: (error?: string | null) => void;
  markConnectionDegraded: (error: string) => void;
  markConnectionDisconnected: () => void;
  clearStudyProcessingState: () => void;
}

const StudyProcessingContext = createContext<StudyProcessingContextValue | null>(null);

export function useStudyProcessing(): StudyProcessingContextValue {
  const context = useContext(StudyProcessingContext);

  if (!context) {
    throw new Error('useStudyProcessing must be used within StudyProcessingProvider');
  }

  return context;
}

export function StudyProcessingProvider({ children }) {
  const [state, dispatch] = useReducer(studyProcessingReducer, initialStudyProcessingState);

  const startInitialSnapshot = useCallback(() => {
    dispatch({ type: 'initialSnapshot.started' });
  }, []);

  const receiveSnapshot = useCallback((summaries: StudyProcessingSummary[]) => {
    dispatch({ type: 'snapshot.received', summaries });
  }, []);

  const failInitialSnapshot = useCallback((error: string) => {
    dispatch({ type: 'initialSnapshot.failed', error });
  }, []);

  const applyStatusUpdate = useCallback((summary: StudyProcessingSummary) => {
    dispatch({ type: 'status.updated', summary });
  }, []);

  const markConnectionConnecting = useCallback(() => {
    dispatch({ type: 'connection.connecting' });
  }, []);

  const markConnectionConnected = useCallback(() => {
    dispatch({ type: 'connection.connected' });
  }, []);

  const markConnectionReconnecting = useCallback((error: string | null = null) => {
    dispatch({ type: 'connection.reconnecting', error });
  }, []);

  const markConnectionDegraded = useCallback((error: string) => {
    dispatch({ type: 'connection.degraded', error });
  }, []);

  const markConnectionDisconnected = useCallback(() => {
    dispatch({ type: 'connection.disconnected' });
  }, []);

  const clearStudyProcessingState = useCallback(() => {
    dispatch({ type: 'state.cleared' });
  }, []);

  const value = useMemo<StudyProcessingContextValue>(
    () => ({
      getStudySummary: studyInstanceUID => selectStudyProcessingSummary(state, studyInstanceUID),
      getVisibleSummaries: visibleStudyInstanceUIDs =>
        selectVisibleStudyProcessingSummaries(state, visibleStudyInstanceUIDs),
      initialSnapshotStatus: selectInitialSnapshotStatus(state),
      initialSnapshotError: selectInitialSnapshotError(state),
      realtimeConnectionStatus: selectRealtimeConnectionStatus(state),
      realtimeConnectionError: selectRealtimeConnectionError(state),
      isRealtimeDataStale: selectIsRealtimeDataStale(state),
      startInitialSnapshot,
      receiveSnapshot,
      failInitialSnapshot,
      applyStatusUpdate,
      markConnectionConnecting,
      markConnectionConnected,
      markConnectionReconnecting,
      markConnectionDegraded,
      markConnectionDisconnected,
      clearStudyProcessingState,
    }),
    [
      applyStatusUpdate,
      clearStudyProcessingState,
      failInitialSnapshot,
      markConnectionConnected,
      markConnectionConnecting,
      markConnectionDegraded,
      markConnectionDisconnected,
      markConnectionReconnecting,
      receiveSnapshot,
      startInitialSnapshot,
      state,
    ]
  );

  return (
    <StudyProcessingContext.Provider value={value}>{children}</StudyProcessingContext.Provider>
  );
}

StudyProcessingProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default StudyProcessingProvider;
