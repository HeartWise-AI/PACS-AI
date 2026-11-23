import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOptionalInferenceProcessing } from '@pacs-ai/extension-core/src/inferenceProcessing/InferenceProcessingProvider';
import type {
  EndedViewerModelRun,
  PendingViewerModelRun,
  ViewerModelResult,
  ViewerModelRunStatus,
} from '../viewerResults/types';
import {
  createStudyProcessingRESTRepository,
  type StudyProcessingRESTRepository,
} from '@pacs-ai/extension-core/src/studyProcessing/restRepository';
import { publishStudyGrowing } from '../studyRefresh/studyGrowingStore';
import { RunningJobsIndicator } from './RunningJobsIndicator';
import { pendingRunRowId, selectRunningJobs } from './runningJobsModel';
import type { RunningJobRow } from './types';
import {
  applyRunningJobCancelStates,
  useRunningJobsCancel,
  type RunningJobCancelOutcome,
} from './useRunningJobsCancel';
import { useRunningJobsCardState } from './useRunningJobsCardState';
import {
  useStudyProcessingRunPoll,
  type StudyProcessingRunPollRepository,
} from './useStudyProcessingRunPoll';

export interface ViewerRunningJobsIndicatorProps {
  studyInstanceUID: string | null;
  pendingRuns: PendingViewerModelRun[];
  pendingRunStatuses?: ReadonlyMap<PendingViewerModelRun, ViewerModelRunStatus>;
  endedRuns?: EndedViewerModelRun[];
  foregroundRun?: PendingViewerModelRun | null;
  onOpenResult?: (result: ViewerModelResult) => void;
  besideReadyNotice?: boolean;
  // A run requested from the viewer was cancelled from the card.
  onRunCancelled?: (run: PendingViewerModelRun) => void;
  // A cancellation of a run requested from the viewer was sent, and its
  // answer is awaited: polls must not report the run as failed meanwhile.
  onRunCancelStarted?: (run: PendingViewerModelRun) => void;
  // The cancellation failed or the run is still running: track it as before.
  onRunCancelAbandoned?: (run: PendingViewerModelRun) => void;
  processingRepository?: StudyProcessingRunPollRepository &
    Partial<Pick<StudyProcessingRESTRepository, 'cancelProcessingRun'>>;
  processingPollIntervalMs?: number;
  lingerMs?: number;
}

// Re-renders every second while `active`, for the elapsed times and for the
// removal of finished rows.
function useSecondTick(active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const interval = window.setInterval(() => setTick(tick => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, [active]);
}

/**
 * The running-jobs indicator of the viewer: runs requested from the viewer
 * (tracked by ViewerModelResultsProvider, which renders this) and the study's
 * server processing run.
 */
export function ViewerRunningJobsIndicator({
  studyInstanceUID,
  pendingRuns,
  pendingRunStatuses,
  endedRuns,
  foregroundRun,
  onOpenResult,
  onRunCancelled,
  onRunCancelStarted,
  onRunCancelAbandoned,
  besideReadyNotice,
  processingRepository,
  processingPollIntervalMs,
  lingerMs,
}: ViewerRunningJobsIndicatorProps) {
  const inferenceProcessing = useOptionalInferenceProcessing();
  const [cancelAttempts, setCancelAttempts] = useState(0);
  const processing = useStudyProcessingRunPoll({
    studyInstanceUID,
    enabled:
      !!inferenceProcessing?.canViewStudyProcessing &&
      !!inferenceProcessing?.canUseStudyProcessingREST,
    repository: processingRepository,
    pollIntervalMs: processingPollIntervalMs,
    // A run that was "already active" when requested is worth looking up,
    // and so is the study's run after a cancellation was attempted.
    refreshKey: `${pendingRuns.filter(run => !run.runId).length}:${cancelAttempts}`,
  });

  // The study browser's refresh button hints that images may still be
  // arriving; it reads this instead of polling anything itself.
  const studyGrowing =
    !!processing.run &&
    !processing.endedAt &&
    (processing.run.phase === 'QUEUED' || processing.run.phase === 'PROCESSING') &&
    processing.run.waitingReason === 'study_growing';
  useEffect(() => {
    publishStudyGrowing(studyInstanceUID, studyGrowing);
    return () => publishStudyGrowing(studyInstanceUID, false);
  }, [studyInstanceUID, studyGrowing]);

  const now = Date.now();
  const { rows } = selectRunningJobs({
    studyInstanceUID,
    pendingRuns,
    pendingRunStatuses,
    endedRuns,
    foregroundRun,
    processingRun: processing.run,
    processingRunSeenAt: processing.seenAt,
    processingRunEndedAt: processing.endedAt,
    now,
    lingerMs,
  });
  const pendingRunsRef = useRef(pendingRuns);
  pendingRunsRef.current = pendingRuns;
  const onRunCancelledRef = useRef(onRunCancelled);
  onRunCancelledRef.current = onRunCancelled;
  const onRunCancelStartedRef = useRef(onRunCancelStarted);
  onRunCancelStartedRef.current = onRunCancelStarted;
  const onRunCancelAbandonedRef = useRef(onRunCancelAbandoned);
  onRunCancelAbandonedRef.current = onRunCancelAbandoned;
  const defaultCancelRepository = useRef<Pick<
    StudyProcessingRESTRepository,
    'cancelProcessingRun'
  > | null>(null);
  const cancelRow = useCallback(
    async (row: RunningJobRow): Promise<RunningJobCancelOutcome> => {
      if (!row.cancelRunId) {
        throw new Error('This run cannot be cancelled.');
      }
      const cancelProcessingRun =
        processingRepository?.cancelProcessingRun ??
        (defaultCancelRepository.current ??= createStudyProcessingRESTRepository())
          .cancelProcessingRun;
      // Found before the request: a poll that sees the cancellation first
      // must neither drop the run nor report it as failed.
      const pending =
        row.kind === 'model'
          ? (pendingRunsRef.current.find(item => pendingRunRowId(item) === row.id) ?? null)
          : null;
      if (pending) {
        onRunCancelStartedRef.current?.(pending);
      }
      let ended = false;
      try {
        const run = await cancelProcessingRun(row.cancelRunId);
        ended = run.phase === 'TERMINAL';
        if (ended && pending) {
          onRunCancelledRef.current?.(pending);
        }
        return ended ? 'ended' : 'stillRunning';
      } finally {
        if (pending && !ended) {
          onRunCancelAbandonedRef.current?.(pending);
        }
        // Whatever happened, the run is worth another look.
        setCancelAttempts(attempts => attempts + 1);
      }
    },
    [processingRepository]
  );
  const cancel = useRunningJobsCancel({ cancel: cancelRow });
  const shownRows = applyRunningJobCancelStates(rows, cancel.states);

  const card = useRunningJobsCardState(rows);
  useSecondTick(rows.length > 0);

  if (!rows.length || card.closed) {
    return null;
  }

  return (
    <RunningJobsIndicator
      rows={shownRows}
      cancelStates={cancel.states}
      onRequestCancel={cancel.request}
      onConfirmCancel={cancel.confirm}
      onAbortCancel={cancel.abort}
      now={now}
      collapsed={card.collapsed}
      onToggleCollapsed={card.toggleCollapsed}
      onClose={card.close}
      onOpenResult={row => {
        if (row.result) {
          onOpenResult?.(row.result);
        }
      }}
      besideReadyNotice={besideReadyNotice}
    />
  );
}

export default ViewerRunningJobsIndicator;
