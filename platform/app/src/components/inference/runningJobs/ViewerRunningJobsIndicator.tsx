import React, { useEffect, useState } from 'react';
import { useOptionalInferenceProcessing } from '../InferenceProcessingProvider';
import type {
  EndedViewerModelRun,
  PendingViewerModelRun,
  ViewerModelResult,
  ViewerModelRunStatus,
} from '../viewerResults/types';
import { RunningJobsIndicator } from './RunningJobsIndicator';
import { selectRunningJobs } from './runningJobsModel';
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
  processingRepository?: StudyProcessingRunPollRepository;
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
  besideReadyNotice,
  processingRepository,
  processingPollIntervalMs,
  lingerMs,
}: ViewerRunningJobsIndicatorProps) {
  const inferenceProcessing = useOptionalInferenceProcessing();
  const processing = useStudyProcessingRunPoll({
    studyInstanceUID,
    enabled:
      !!inferenceProcessing?.canViewStudyProcessing &&
      !!inferenceProcessing?.canUseStudyProcessingREST,
    repository: processingRepository,
    pollIntervalMs: processingPollIntervalMs,
    // A run that was "already active" when requested is worth looking up.
    refreshKey: pendingRuns.filter(run => !run.runId).length,
  });

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
  const card = useRunningJobsCardState(rows);
  useSecondTick(rows.length > 0);

  if (!rows.length || card.closed) {
    return null;
  }

  return (
    <RunningJobsIndicator
      rows={rows}
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
