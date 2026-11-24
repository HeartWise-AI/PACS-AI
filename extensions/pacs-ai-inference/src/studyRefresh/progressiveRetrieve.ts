// Opening a study while the rest of it is still coming from the PACS.
//
// The server moves a study one series at a time, first series first, and
// tells which job moves which series (`order`, 0 = first). The work list opens
// the viewer as soon as the first series is stored and hands the remaining
// jobs to the viewer, which reloads the study's series as they arrive.

import {
  RETRIEVE_JOBS_POLL_INTERVAL_MS,
  RETRIEVE_JOBS_TIMEOUT_MS,
  summarizeRetrieveJobs,
  type RetrieveJobInfo,
} from './retrieveJobs';

export interface RetrieveJobRef {
  id?: string | null;
  order?: number | null;
}

const SUCCESS_STATE = 'Success';
const FAILURE_STATE = 'Failure';

// A job that will not move any more series: succeeded or failed.
function isJobFinished(job: RetrieveJobInfo): boolean {
  return job.state === FAILURE_STATE || job.state === SUCCESS_STATE || job.progress === 100;
}

/**
 * The jobs that must finish before the viewer can open: the first series.
 * Every job when the server does not say which series comes first (an older
 * server), so the work list then waits for the whole study as before.
 */
export function firstSeriesJobIds(jobs: readonly RetrieveJobRef[]): string[] {
  const ids = jobs.map(job => job.id).filter((id): id is string => typeof id === 'string' && !!id);
  const ordered = jobs.filter(
    (job): job is { id: string; order: number } =>
      typeof job.id === 'string' && !!job.id && typeof job.order === 'number'
  );
  if (ordered.length !== ids.length || ordered.length === 0) {
    return ids;
  }
  const first = Math.min(...ordered.map(job => job.order));
  return ordered.filter(job => job.order === first).map(job => job.id);
}

/** True once every job of the first series has succeeded. */
export function isReadyToOpen(
  jobs: readonly RetrieveJobInfo[],
  firstIds: readonly string[]
): boolean {
  if (!firstIds.length) {
    return false;
  }
  const byId = new Map(jobs.map(job => [job.id, job]));
  return firstIds.every(id => {
    const job = byId.get(id);
    return !!job && job.progress === 100 && job.state === SUCCESS_STATE;
  });
}

// --- handing the remaining jobs to the viewer --------------------------------

export const PENDING_RETRIEVE_STORAGE_KEY = 'pacsai.pendingRetrieve';
// A hand-over older than this is ignored: the retrieve is long over.
export const PENDING_RETRIEVE_MAX_AGE_MS = 10 * 60_000;

interface PendingRetrieve {
  jobIds: string[];
  at: number;
}

type Storage2 = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): Storage2 | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch (ignored) {
    return null;
  }
}

function readAll(storage: Storage2): Record<string, PendingRetrieve> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PENDING_RETRIEVE_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, PendingRetrieve>) : {};
  } catch (ignored) {
    return {};
  }
}

export function rememberPendingRetrieve(
  studyInstanceUID: string,
  jobIds: readonly string[],
  {
    storage = defaultStorage(),
    now = Date.now,
    // When the hand-over was first made; kept when it is handed back.
    at = undefined as number | undefined,
  } = {}
): void {
  if (!storage || !studyInstanceUID || !jobIds.length) {
    return;
  }
  const all = readAll(storage);
  all[studyInstanceUID] = { jobIds: [...jobIds], at: typeof at === 'number' ? at : now() };
  try {
    storage.setItem(PENDING_RETRIEVE_STORAGE_KEY, JSON.stringify(all));
  } catch (ignored) {
    // Storage full or blocked: the viewer then shows what is stored so far.
  }
}

export interface PendingRetrieveHandover {
  jobIds: string[];
  // When the work list handed the jobs over.
  at: number;
}

/**
 * The hand-over of a study's remaining jobs, once; null when there is none or
 * it is too old. Give it back with rememberPendingRetrieve (with its `at`)
 * when following it stops before the jobs ended.
 */
export function takePendingRetrieveHandover(
  studyInstanceUID: string | null | undefined,
  { storage = defaultStorage(), now = Date.now } = {}
): PendingRetrieveHandover | null {
  if (!storage || !studyInstanceUID) {
    return null;
  }
  const all = readAll(storage);
  const entry = all[studyInstanceUID];
  if (!entry) {
    return null;
  }
  delete all[studyInstanceUID];
  try {
    storage.setItem(PENDING_RETRIEVE_STORAGE_KEY, JSON.stringify(all));
  } catch (ignored) {
    // ignore
  }
  const fresh = typeof entry.at === 'number' && now() - entry.at <= PENDING_RETRIEVE_MAX_AGE_MS;
  const jobIds =
    fresh && Array.isArray(entry.jobIds) ? entry.jobIds.filter(id => typeof id === 'string') : [];
  return jobIds.length ? { jobIds, at: entry.at } : null;
}

/** The jobs still moving a study's series, once; [] when there are none. */
export function takePendingRetrieve(
  studyInstanceUID: string | null | undefined,
  options: { storage?: Storage2 | null; now?: () => number } = {}
): string[] {
  return takePendingRetrieveHandover(studyInstanceUID, options)?.jobIds ?? [];
}

// --- the viewer following the rest of the retrieve ---------------------------

// Least time between two reloads of the study's series.
export const PROGRESSIVE_RELOAD_MIN_INTERVAL_MS = 2_000;

export interface FollowPendingRetrieveOptions {
  jobIds: readonly string[];
  loadJobs: (jobIds: string[]) => Promise<readonly RetrieveJobInfo[]>;
  // Reloads the study's series in the viewer.
  reload: () => Promise<void>;
  isCancelled?: () => boolean;
  intervalMs?: number;
  timeoutMs?: number;
  minReloadIntervalMs?: number;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type FollowOutcome = 'done' | 'failed' | 'timedOut' | 'cancelled';

const defaultWait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Polls the remaining retrieve jobs and reloads the study's series each time
 * more of them are complete (at most every minReloadIntervalMs), and once at
 * the end, so every series that arrived is shown even when a job failed. A
 * failed job does not end the follow while other jobs are still moving.
 */
export async function followPendingRetrieve({
  jobIds,
  loadJobs,
  reload,
  isCancelled = () => false,
  intervalMs = RETRIEVE_JOBS_POLL_INTERVAL_MS,
  timeoutMs = RETRIEVE_JOBS_TIMEOUT_MS,
  minReloadIntervalMs = PROGRESSIVE_RELOAD_MIN_INTERVAL_MS,
  wait = defaultWait,
  now = Date.now,
}: FollowPendingRetrieveOptions): Promise<FollowOutcome> {
  if (!jobIds.length) {
    return 'done';
  }
  const startedAt = now();
  let shownCompleted = 0;
  let lastReloadAt = -Infinity;
  let statusFailures = 0;

  const safeReload = async () => {
    lastReloadAt = now();
    try {
      await reload();
    } catch (ignored) {
      // The next reload, or the user's refresh button, tries again.
    }
  };

  for (;;) {
    if (isCancelled()) {
      return 'cancelled';
    }
    let jobs: readonly RetrieveJobInfo[] | null = null;
    try {
      jobs = await loadJobs([...jobIds]);
      statusFailures = 0;
    } catch (ignored) {
      statusFailures += 1;
    }
    if (isCancelled()) {
      return 'cancelled';
    }
    if (jobs) {
      const summary = summarizeRetrieveJobs(jobs);
      // A failed job does not stop the others: follow them until every job
      // has ended, then show what arrived.
      if (summary.done || (jobs.length > 0 && jobs.every(isJobFinished))) {
        await safeReload();
        return summary.failed ? 'failed' : 'done';
      }
      if (summary.completed > shownCompleted && now() - lastReloadAt >= minReloadIntervalMs) {
        shownCompleted = summary.completed;
        await safeReload();
      }
    }
    if (statusFailures >= 3 || now() - startedAt >= timeoutMs) {
      await safeReload();
      return 'timedOut';
    }
    await wait(intervalMs);
  }
}
