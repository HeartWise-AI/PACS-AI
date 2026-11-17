// Progress of the Orthanc jobs that retrieve a study from the PACS into the
// local store. Shared by the work list (which waits for them before opening
// the viewer) and the viewer's "Refresh study from PACS".

export interface RetrieveJobInfo {
  id?: string;
  progress: number;
  state?: string;
}

export interface RetrieveJobsSummary {
  total: number;
  completed: number;
  // Share of the jobs that are complete, rounded down: the work list's bar.
  overallProgress: number;
  // Mean progress of the jobs, rounded down: finer, for an inline percentage.
  averageProgress: number;
  failed: boolean;
  done: boolean;
}

const FAILURE_STATE = 'Failure';

export function summarizeRetrieveJobs(jobs: readonly RetrieveJobInfo[]): RetrieveJobsSummary {
  const total = jobs.length;
  const completed = jobs.filter(job => job.progress === 100).length;
  const sum = jobs.reduce(
    (acc, job) => acc + Math.min(100, Math.max(0, Number(job.progress) || 0)),
    0
  );
  return {
    total,
    completed,
    overallProgress: total ? Math.floor((completed / total) * 100) : 0,
    averageProgress: total ? Math.floor(sum / total) : 0,
    failed: jobs.some(job => job.state === FAILURE_STATE),
    done: total > 0 && completed === total,
  };
}

export type RetrieveJobsFailure = 'failed' | 'timedOut' | 'unavailable';

export class RetrieveJobsError extends Error {
  readonly reason: RetrieveJobsFailure;

  constructor(reason: RetrieveJobsFailure) {
    super(`Study retrieval ${reason}`);
    this.name = 'RetrieveJobsError';
    this.reason = reason;
  }
}

export const RETRIEVE_JOBS_POLL_INTERVAL_MS = 1_000;
export const RETRIEVE_JOBS_TIMEOUT_MS = 10 * 60_000;
// Consecutive failed status requests after which the wait is given up.
const MAX_STATUS_FAILURES = 3;

export interface PollRetrieveJobsOptions {
  jobIds: readonly string[];
  loadJobs: (jobIds: string[]) => Promise<readonly RetrieveJobInfo[]>;
  onProgress?: (summary: RetrieveJobsSummary) => void;
  intervalMs?: number;
  timeoutMs?: number;
  // True once the caller is no longer interested; the wait then ends quietly.
  isCancelled?: () => boolean;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultWait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Waits until every retrieval job is complete. Resolves true when they all
 * completed and false when cancelled; rejects with RetrieveJobsError when a
 * job failed, the jobs took too long or their status cannot be read.
 */
export async function pollRetrieveJobs({
  jobIds,
  loadJobs,
  onProgress,
  intervalMs = RETRIEVE_JOBS_POLL_INTERVAL_MS,
  timeoutMs = RETRIEVE_JOBS_TIMEOUT_MS,
  isCancelled = () => false,
  wait = defaultWait,
  now = Date.now,
}: PollRetrieveJobsOptions): Promise<boolean> {
  if (!jobIds.length) {
    return true;
  }
  const startedAt = now();
  let statusFailures = 0;

  for (;;) {
    if (isCancelled()) {
      return false;
    }

    let jobs: readonly RetrieveJobInfo[] | null = null;
    try {
      jobs = await loadJobs([...jobIds]);
      statusFailures = 0;
    } catch (error: unknown) {
      statusFailures += 1;
      if (statusFailures >= MAX_STATUS_FAILURES) {
        throw new RetrieveJobsError('unavailable');
      }
    }
    if (isCancelled()) {
      return false;
    }

    if (jobs) {
      const summary = summarizeRetrieveJobs(jobs);
      onProgress?.(summary);
      if (summary.failed) {
        throw new RetrieveJobsError('failed');
      }
      if (summary.done) {
        return true;
      }
    }

    if (now() - startedAt >= timeoutMs) {
      throw new RetrieveJobsError('timedOut');
    }
    await wait(intervalMs);
  }
}
