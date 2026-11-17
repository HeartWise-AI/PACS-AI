import type { StudyProcessingRunHistory, StudyProcessingSummary } from './types';

export interface RunHistorySynchronizationTarget {
  runId: string;
  version: number;
}

interface PendingRunHistorySynchronization {
  target: RunHistorySynchronizationTarget;
  refresh: () => Promise<void>;
}

export interface RunHistorySynchronizationCoordinator {
  request: (target: RunHistorySynchronizationTarget, refresh: () => Promise<void>) => Promise<void>;
  reset: () => void;
}

function isNewerTarget(
  candidate: RunHistorySynchronizationTarget,
  current: RunHistorySynchronizationTarget | null
): boolean {
  if (!current || candidate.runId !== current.runId) {
    return true;
  }

  return candidate.version > current.version;
}

export function getRunHistorySynchronizationTarget(
  summary: StudyProcessingSummary | undefined,
  history: StudyProcessingRunHistory | null
): RunHistorySynchronizationTarget | null {
  if (!summary?.runId || summary.version === null || !history) {
    return null;
  }

  const cachedRun = history.runs.find(run => run.id === summary.runId);
  if (cachedRun && cachedRun.version >= summary.version) {
    return null;
  }

  return {
    runId: summary.runId,
    version: summary.version,
  };
}

export function createRunHistorySynchronizationCoordinator(): RunHistorySynchronizationCoordinator {
  let generation = 0;
  let inFlightRequest: Promise<void> | null = null;
  let lastAttemptedTarget: RunHistorySynchronizationTarget | null = null;
  let pendingSynchronization: PendingRunHistorySynchronization | null = null;

  const drain = (): Promise<void> => {
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const synchronization = pendingSynchronization;
    if (!synchronization) {
      return Promise.resolve();
    }

    pendingSynchronization = null;
    lastAttemptedTarget = synchronization.target;
    const requestGeneration = generation;
    const request = Promise.resolve().then(synchronization.refresh);

    inFlightRequest = request.finally(() => {
      if (requestGeneration !== generation) {
        return;
      }

      inFlightRequest = null;
      if (pendingSynchronization) {
        return drain();
      }
    });

    return inFlightRequest;
  };

  return {
    request(target, refresh) {
      if (!isNewerTarget(target, lastAttemptedTarget)) {
        return inFlightRequest ?? Promise.resolve();
      }

      if (pendingSynchronization && !isNewerTarget(target, pendingSynchronization.target)) {
        return inFlightRequest ?? Promise.resolve();
      }

      pendingSynchronization = { target, refresh };
      return drain();
    },
    reset() {
      generation += 1;
      inFlightRequest = null;
      lastAttemptedTarget = null;
      pendingSynchronization = null;
    },
  };
}
