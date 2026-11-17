import { useEffect, useRef } from 'react';
import inferenceRepository from '../api/inferenceRepository';

const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed']);
const POLL_INTERVAL_MS = 12_000;

export type ProcessingTransitionEvent = {
  candidateId: string;
  studyInstanceUID: string;
  patientId: string;
  modalitiesInStudy: string;
  processingStatus: 'completed' | 'partial' | 'failed';
  processingStatusAt: number;
};

type UseCandidateProcessingPollOptions = {
  onTransition: (event: ProcessingTransitionEvent) => void;
  enabled?: boolean;
};

function isIgnorablePollError(error: { errorCode?: string }) {
  return (
    error?.errorCode === 'MISSING_RECORD' || error?.errorCode === 'UNAUTHORIZED_ACCESS'
  );
}

export function useCandidateProcessingPoll({
  onTransition,
  enabled = true,
}: UseCandidateProcessingPollOptions) {
  const onTransitionRef = useRef(onTransition);
  const lastStatusRef = useRef<Map<string, string>>(new Map());
  const pollInFlightRef = useRef(false);
  const enabledRef = useRef(enabled);

  onTransitionRef.current = onTransition;
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      lastStatusRef.current = new Map();
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (!enabledRef.current || pollInFlightRef.current) {
        return;
      }

      pollInFlightRef.current = true;

      try {
        const response = await inferenceRepository.GetInferenceIngestionCandidates();
        if (!enabledRef.current) {
          return;
        }
        const candidates = response.data ?? [];
        const currentIds = new Set(candidates.map(candidate => candidate.id));

        for (const id of lastStatusRef.current.keys()) {
          if (!currentIds.has(id)) {
            lastStatusRef.current.delete(id);
          }
        }

        for (const candidate of candidates) {
          const previousStatus = lastStatusRef.current.get(candidate.id);
          const nextStatus = candidate.processingStatus || '';

          if (
            previousStatus !== undefined &&
            TERMINAL_STATUSES.has(nextStatus) &&
            !TERMINAL_STATUSES.has(previousStatus)
          ) {
            onTransitionRef.current({
              candidateId: candidate.id,
              studyInstanceUID: candidate.studyInstanceUID,
              patientId: candidate.patientId || 'Unknown patient',
              modalitiesInStudy: candidate.modalitiesInStudy || 'Unknown modality',
              processingStatus: nextStatus as ProcessingTransitionEvent['processingStatus'],
              processingStatusAt: candidate.processingStatusAt,
            });
          }

          lastStatusRef.current.set(candidate.id, nextStatus);
        }
      } catch (error) {
        if (!isIgnorablePollError(error as { errorCode?: string })) {
          console.debug('candidate processing poll failed', error);
        }
      } finally {
        pollInFlightRef.current = false;
      }
    };

    const start = () => {
      if (intervalId) {
        return;
      }
      poll();
      intervalId = setInterval(poll, POLL_INTERVAL_MS);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (document.visibilityState === 'visible') {
      start();
    }

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      lastStatusRef.current = new Map();
    };
  }, [enabled]);
}
