import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useStudyProcessing } from './StudyProcessingProvider';
import type { StudyProcessingSnapshotTransport } from './snapshotTransport';

export interface UseVisibleStudyProcessingSnapshotOptions {
  enabled: boolean;
  fixtureMode: boolean;
  studyInstanceUIDs: string[];
  transport: StudyProcessingSnapshotTransport;
}

export function useVisibleStudyProcessingSnapshot({
  enabled,
  fixtureMode,
  studyInstanceUIDs,
  transport,
}: UseVisibleStudyProcessingSnapshotOptions): () => void {
  const {
    clearStudyProcessingState,
    failInitialSnapshot,
    markConnectionConnected,
    receiveSnapshot,
    startInitialSnapshot,
  } = useStudyProcessing();
  const requestGeneration = useRef(0);
  const previousTransport = useRef(transport);
  const [requestVersion, requestRetry] = useReducer(version => version + 1, 0);
  const retry = useCallback(() => requestRetry(), []);

  useEffect(() => {
    if (!enabled) {
      requestGeneration.current += 1;
      return;
    }

    if (previousTransport.current !== transport) {
      clearStudyProcessingState();
      previousTransport.current = transport;
    }

    const generation = ++requestGeneration.current;
    startInitialSnapshot();

    void transport
      .loadVisibleStudySnapshot(studyInstanceUIDs)
      .then(summaries => {
        if (generation !== requestGeneration.current) {
          return;
        }

        receiveSnapshot(summaries);
        if (fixtureMode) {
          markConnectionConnected();
        }
      })
      .catch((error: unknown) => {
        if (generation !== requestGeneration.current) {
          return;
        }

        failInitialSnapshot(
          error instanceof Error ? error.message : 'Unable to load processing status.'
        );
      });

    return () => {
      if (generation === requestGeneration.current) {
        requestGeneration.current += 1;
      }
    };
  }, [
    clearStudyProcessingState,
    enabled,
    failInitialSnapshot,
    fixtureMode,
    markConnectionConnected,
    receiveSnapshot,
    requestVersion,
    startInitialSnapshot,
    studyInstanceUIDs,
    transport,
  ]);

  return retry;
}
