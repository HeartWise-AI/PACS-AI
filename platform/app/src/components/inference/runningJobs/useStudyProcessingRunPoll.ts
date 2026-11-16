import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createStudyProcessingRESTRepository,
  type StudyProcessingRESTRepository,
} from '../studyProcessing/restRepository';
import type { ProcessingRun, StudyProcessingSummary } from '../studyProcessing/types';

export const STUDY_PROCESSING_RUN_POLL_INTERVAL_MS = 5_000;

export type StudyProcessingRunPollRepository = Pick<
  StudyProcessingRESTRepository,
  'loadWorklistStudyStatuses' | 'loadProcessingRunDetail'
>;

export interface StudyProcessingRunPollState {
  run: ProcessingRun | null;
  // Client time the run was first seen / seen to have ended.
  seenAt: number | null;
  endedAt: number | null;
}

export interface UseStudyProcessingRunPollOptions {
  studyInstanceUID: string | null;
  enabled: boolean;
  repository?: StudyProcessingRunPollRepository;
  pollIntervalMs?: number;
  // Changing this value asks for one more check of the study's status.
  refreshKey?: unknown;
}

const IDLE: StudyProcessingRunPollState = { run: null, seenAt: null, endedAt: null };

function isActive(run: Pick<ProcessingRun, 'phase'> | null): boolean {
  return !!run && (run.phase === 'QUEUED' || run.phase === 'PROCESSING');
}

// The worklist status carries the run's counts but not its executions.
function runFromSummary(summary: StudyProcessingSummary): ProcessingRun | null {
  if (!summary.runId || !summary.phase) {
    return null;
  }
  return {
    id: summary.runId,
    studyInstanceUID: summary.studyInstanceUID,
    runNumber: summary.runNumber ?? 0,
    trigger: summary.trigger ?? 'AUTO',
    phase: summary.phase,
    outcome: summary.outcome,
    attentionRequired: summary.attentionRequired,
    attentionReasons: summary.attentionReasons,
    version: summary.version ?? 0,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
    createdAt: summary.startedAt ?? summary.updatedAt,
    updatedAt: summary.updatedAt,
    expectedModels: summary.expectedModels,
    pendingModels: summary.pendingModels,
    queuedModels: summary.queuedModels,
    runningModels: summary.runningModels,
    completedModels: summary.completedModels,
    failedModels: summary.failedModels,
    skippedModels: summary.skippedModels,
    cancelledModels: summary.cancelledModels,
    activeModels: summary.activeModels,
    modelExecutions: [],
  };
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/**
 * Follows the server processing run of the study open in the viewer, where
 * the work list's live status stream is not connected. The study's status is
 * read once (again when the tab becomes visible or `refreshKey` changes);
 * only while a run is queued or processing is its detail polled, and never
 * while the tab is hidden.
 */
export function useStudyProcessingRunPoll({
  studyInstanceUID,
  enabled,
  repository: providedRepository,
  pollIntervalMs = STUDY_PROCESSING_RUN_POLL_INTERVAL_MS,
  refreshKey,
}: UseStudyProcessingRunPollOptions): StudyProcessingRunPollState {
  const repository = useMemo(
    () => (enabled ? (providedRepository ?? createStudyProcessingRESTRepository()) : null),
    [enabled, providedRepository]
  );
  const uid = studyInstanceUID?.trim() || null;
  const visible = usePageVisible();
  const [state, setState] = useState<StudyProcessingRunPollState>(IDLE);
  const stateRef = useRef(state);
  const generation = useRef(0);
  // Generation of the check in flight; one of a previous study does not count.
  const inFlight = useRef<number | null>(null);
  stateRef.current = state;

  const check = useCallback(async () => {
    const requestGeneration = generation.current;
    if (!uid || !repository || inFlight.current === requestGeneration) {
      return;
    }
    inFlight.current = requestGeneration;
    try {
      const current = stateRef.current;
      let run: ProcessingRun | null = null;

      // A run detail that cannot be loaded falls back to the study's status,
      // whose counts are enough to show the run.
      const loadDetail = (runId: string) =>
        repository.loadProcessingRunDetail(runId).catch(() => null);

      if (current.run && isActive(current.run)) {
        run = await loadDetail(current.run.id);
      }

      if (!run) {
        const { summaries } = await repository.loadWorklistStudyStatuses({
          studyInstanceUIDs: [uid],
        });
        const summary = summaries.find(item => item.studyInstanceUID === uid);
        run = summary ? runFromSummary(summary) : null;
        if (run && isActive(run)) {
          const detail = await loadDetail(run.id);
          if (detail) {
            run = detail;
          }
        }
      }

      if (requestGeneration !== generation.current) {
        return;
      }

      setState(previous => {
        if (run && isActive(run)) {
          return {
            run,
            seenAt: previous.run?.id === run.id ? previous.seenAt : Date.now(),
            endedAt: null,
          };
        }
        // Only a run that was seen active is shown as finished.
        if (run && previous.run?.id === run.id) {
          return isActive(previous.run)
            ? { run, seenAt: previous.seenAt, endedAt: Date.now() }
            : previous;
        }
        if (previous.run && isActive(previous.run)) {
          // The study moved on without reporting how the run ended.
          return IDLE;
        }
        return previous;
      });
    } catch (error: unknown) {
      // Transient failures are retried on the next check.
    } finally {
      if (inFlight.current === requestGeneration) {
        inFlight.current = null;
      }
    }
  }, [repository, uid]);

  useEffect(() => {
    generation.current += 1;
    stateRef.current = IDLE;
    setState(IDLE);
  }, [uid, enabled]);

  useEffect(() => {
    if (enabled && uid && visible) {
      void check();
    }
  }, [check, enabled, uid, visible, refreshKey]);

  const active = isActive(state.run);
  useEffect(() => {
    if (!enabled || !uid || !visible || !active) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void check();
    }, pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [active, check, enabled, pollIntervalMs, uid, visible]);

  return enabled && uid ? state : IDLE;
}
