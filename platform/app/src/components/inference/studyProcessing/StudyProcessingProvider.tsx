import React, { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import PropTypes from 'prop-types';
import type { StudyProcessingSummary } from './types';
import {
  initialStudyProcessingState,
  studyProcessingReducer,
  type InitialSnapshotStatus,
  type RealtimeConnectionStatus,
} from './reducer';
import {
  createIdleRunHistoryEntry,
  initialRunHistoryState,
  runHistoryReducer,
  type RunHistoryEntry,
} from './runHistoryReducer';
import {
  createFixtureRunHistoryTransport,
  RunHistoryUnavailableError,
  type StudyProcessingRunHistoryTransport,
} from './runHistoryTransport';
import {
  selectInitialSnapshotError,
  selectInitialSnapshotRetryable,
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
  initialSnapshotRetryable: boolean;
  realtimeConnectionStatus: RealtimeConnectionStatus;
  realtimeConnectionError: string | null;
  isRealtimeDataStale: boolean;
  startInitialSnapshot: () => void;
  receiveSnapshot: (summaries: StudyProcessingSummary[]) => void;
  failInitialSnapshot: (error: string, retryable?: boolean) => void;
  applyStatusUpdate: (summary: StudyProcessingSummary) => void;
  markConnectionConnecting: () => void;
  markConnectionConnected: () => void;
  markConnectionReconnecting: (error?: string | null) => void;
  markConnectionDegraded: (error: string) => void;
  markConnectionDisconnected: () => void;
  getRunHistoryEntry: (studyInstanceUID: string) => RunHistoryEntry;
  ensureRunHistory: (
    studyInstanceUID: string,
    transport?: StudyProcessingRunHistoryTransport
  ) => Promise<void>;
  refreshRunHistory: (
    studyInstanceUID: string,
    transport?: StudyProcessingRunHistoryTransport
  ) => Promise<void>;
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

export interface StudyProcessingProviderProps {
  children: React.ReactNode;
  runHistoryTransport?: StudyProcessingRunHistoryTransport;
}

export function StudyProcessingProvider({
  children,
  runHistoryTransport,
}: StudyProcessingProviderProps) {
  const [state, dispatch] = useReducer(studyProcessingReducer, initialStudyProcessingState);
  const [runHistoryState, dispatchRunHistory] = useReducer(
    runHistoryReducer,
    initialRunHistoryState
  );
  const inFlightRunHistoryRequests = useRef<Record<string, Promise<void>>>({});
  const runHistoryRequestGeneration = useRef(0);
  const runHistoryEntriesRef = useRef(runHistoryState.entriesByStudyInstanceUID);

  const effectiveRunHistoryTransport = useMemo(
    () =>
      runHistoryTransport ??
      createFixtureRunHistoryTransport(
        studyInstanceUID => state.summariesByStudyInstanceUID[studyInstanceUID]
      ),
    [runHistoryTransport, state.summariesByStudyInstanceUID]
  );
  const effectiveRunHistoryTransportRef = useRef(effectiveRunHistoryTransport);
  runHistoryEntriesRef.current = runHistoryState.entriesByStudyInstanceUID;
  effectiveRunHistoryTransportRef.current = effectiveRunHistoryTransport;

  const startInitialSnapshot = useCallback(() => {
    dispatch({ type: 'initialSnapshot.started' });
  }, []);

  const receiveSnapshot = useCallback((summaries: StudyProcessingSummary[]) => {
    dispatch({ type: 'snapshot.received', summaries });
  }, []);

  const failInitialSnapshot = useCallback((error: string, retryable = true) => {
    dispatch({ type: 'initialSnapshot.failed', error, retryable });
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

  const requestRunHistory = useCallback(
    (
      studyInstanceUID: string,
      forceRefresh: boolean,
      transport?: StudyProcessingRunHistoryTransport
    ): Promise<void> => {
      const currentEntry = runHistoryEntriesRef.current[studyInstanceUID];

      if (!forceRefresh && currentEntry?.history) {
        return Promise.resolve();
      }

      const existingRequest = inFlightRunHistoryRequests.current[studyInstanceUID];
      if (existingRequest) {
        return existingRequest;
      }

      dispatchRunHistory({
        type: 'runHistory.loadStarted',
        studyInstanceUID,
      });

      const requestGeneration = runHistoryRequestGeneration.current;
      const request = (transport ?? effectiveRunHistoryTransportRef.current)
        .loadRunHistory(studyInstanceUID)
        .then(response => {
          if (requestGeneration !== runHistoryRequestGeneration.current) {
            return;
          }

          dispatchRunHistory({
            type: 'runHistory.received',
            history: response.history,
            partial: response.partial,
          });
        })
        .catch((error: unknown) => {
          if (requestGeneration !== runHistoryRequestGeneration.current) {
            return;
          }

          const message =
            error instanceof Error ? error.message : 'Unable to load processing run history.';
          if (error instanceof RunHistoryUnavailableError) {
            dispatchRunHistory({
              type: 'runHistory.unavailable',
              studyInstanceUID,
              error: message,
              retryable: error.retryable,
            });
          } else {
            dispatchRunHistory({
              type: 'runHistory.failed',
              studyInstanceUID,
              error: message,
            });
          }
        })
        .finally(() => {
          if (inFlightRunHistoryRequests.current[studyInstanceUID] === request) {
            delete inFlightRunHistoryRequests.current[studyInstanceUID];
          }
        });

      inFlightRunHistoryRequests.current[studyInstanceUID] = request;
      return request;
    },
    []
  );

  const ensureRunHistory = useCallback(
    (studyInstanceUID: string, transport?: StudyProcessingRunHistoryTransport) =>
      requestRunHistory(studyInstanceUID, false, transport),
    [requestRunHistory]
  );

  const refreshRunHistory = useCallback(
    (studyInstanceUID: string, transport?: StudyProcessingRunHistoryTransport) =>
      requestRunHistory(studyInstanceUID, true, transport),
    [requestRunHistory]
  );

  const clearStudyProcessingState = useCallback(() => {
    runHistoryRequestGeneration.current += 1;
    inFlightRunHistoryRequests.current = {};
    dispatch({ type: 'state.cleared' });
    dispatchRunHistory({ type: 'runHistory.stateCleared' });
  }, []);

  const value = useMemo<StudyProcessingContextValue>(
    () => ({
      getStudySummary: studyInstanceUID => selectStudyProcessingSummary(state, studyInstanceUID),
      getVisibleSummaries: visibleStudyInstanceUIDs =>
        selectVisibleStudyProcessingSummaries(state, visibleStudyInstanceUIDs),
      initialSnapshotStatus: selectInitialSnapshotStatus(state),
      initialSnapshotError: selectInitialSnapshotError(state),
      initialSnapshotRetryable: selectInitialSnapshotRetryable(state),
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
      getRunHistoryEntry: studyInstanceUID =>
        runHistoryState.entriesByStudyInstanceUID[studyInstanceUID] ?? createIdleRunHistoryEntry(),
      ensureRunHistory,
      refreshRunHistory,
      clearStudyProcessingState,
    }),
    [
      applyStatusUpdate,
      clearStudyProcessingState,
      failInitialSnapshot,
      ensureRunHistory,
      markConnectionConnected,
      markConnectionConnecting,
      markConnectionDegraded,
      markConnectionDisconnected,
      markConnectionReconnecting,
      receiveSnapshot,
      refreshRunHistory,
      runHistoryState.entriesByStudyInstanceUID,
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
  runHistoryTransport: PropTypes.shape({
    loadRunHistory: PropTypes.func.isRequired,
  }),
};

export default StudyProcessingProvider;
