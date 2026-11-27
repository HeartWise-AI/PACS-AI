// Getting a study into the local store before the viewer opens it.
//
// The local store (Orthanc) is a cache: a study is removed about 24 hours
// after it arrived. The work list therefore retrieves the study from its PACS
// source (C-MOVE through api-pacs) every time it opens it, and opens the
// viewer once the first series is stored. A link that went straight to
// /viewer (processing notifications, AI Predictions, feedback tabs, the
// sign-in handoff) skipped that step and landed on "study not available" once
// the study had left the cache. Every such link now goes through /open-study,
// which runs this flow first.

import orthancRepository from '@pacs-ai/extension-core/src/api/orthancRepository';
import Api from '@pacs-ai/extension-core/src/pacsAPIAxios';
import { STUDY_NOTIFICATION_QIDO_PATH } from '@pacs-ai/extension-core/src/inferenceProcessing/studyNotificationMetadataRepository';
import { Error as APIErrorCode } from '@pacs-ai/extension-core/src/api/dto';
import {
  RETRIEVE_JOBS_POLL_INTERVAL_MS,
  RETRIEVE_JOBS_TIMEOUT_MS,
  summarizeRetrieveJobs,
  type RetrieveJobInfo,
} from './retrieveJobs';
import { firstSeriesJobIds, isReadyToOpen, type RetrieveJobRef } from './progressiveRetrieve';
import {
  rememberStudySourceModality,
  resolveSourceModality,
  type SourceModalities,
} from './sourceModality';

export interface OpenStudyRepository {
  loadModalities: () => Promise<SourceModalities | null | undefined>;
  // The retrieval jobs ([] when the local copy already has every series).
  retrieveStudy: (request: {
    modalityId: string;
    studyInstanceUID: string;
  }) => Promise<RetrieveJobRef[]>;
  loadJobs: (jobIds: string[]) => Promise<readonly RetrieveJobInfo[]>;
  // True when the local store has the study, false when it answered that it
  // has not; rejects when it cannot be asked.
  isStored: (studyInstanceUID: string) => Promise<boolean>;
}

type HTTPGet = (
  url: string,
  config: { headers: Record<string, string>; params: Record<string, string>; timeout: number }
) => Promise<{ data?: unknown }>;

/** Asks the local store (the viewer's DICOMweb source) whether it has the study. */
export async function isStudyInLocalStore(
  studyInstanceUID: string,
  get: HTTPGet = (url, config) => Api().get(url, config)
): Promise<boolean> {
  const response = await get(STUDY_NOTIFICATION_QIDO_PATH, {
    headers: { Accept: 'application/dicom+json' },
    params: { StudyInstanceUID: studyInstanceUID, limit: '2' },
    timeout: 10_000,
  });
  const data = response?.data;
  // Only an entry carrying the requested UID counts (a server could ignore the filter).
  return (
    Array.isArray(data) &&
    data.some(
      study =>
        (study as Record<string, { Value?: unknown[] }> | null)?.['0020000D']?.Value?.[0] ===
        studyInstanceUID
    )
  );
}

/** The api-pacs calls of the work list's "open": retrieve, job status, QIDO. */
export function createOpenStudyRepository(
  api = orthancRepository,
  isStored: OpenStudyRepository['isStored'] = uid => isStudyInLocalStore(uid)
): OpenStudyRepository {
  return {
    loadModalities: async () => {
      const response = await api.GetDICOMModalities();
      return response.data?.modalities ?? null;
    },
    retrieveStudy: async request => {
      try {
        const response = await api.RetrieveModalityStudy(request);
        return (response.data ?? []).filter(job => !!job?.id);
      } catch (error: unknown) {
        // "Duplicate": the local copy already has every series of the PACS.
        if ((error as { errorCode?: string } | null)?.errorCode === APIErrorCode.DUPLICATE_RECORD) {
          return [];
        }
        throw error;
      }
    },
    loadJobs: async jobIds => {
      const response = await api.GetJobsInfo({ jobIds });
      const jobs = response.data as unknown;
      return Array.isArray(jobs) ? jobs : [];
    },
    isStored,
  };
}

export type OpenStudyFailure =
  // No PACS source to retrieve from, and the local store does not have it.
  | 'noSource'
  // The PACS refused or could not be reached, and the local store does not have it.
  | 'retrieveFailed'
  | 'timedOut';

export type OpenStudyOutcome =
  | { status: 'open'; remainingJobIds: string[]; modalityId: string | null }
  | { status: 'failed'; reason: OpenStudyFailure }
  | { status: 'cancelled' };

export interface PrepareStudyOptions {
  studyInstanceUID: string;
  repository: OpenStudyRepository;
  // Share of the retrieval jobs completed (0–100), null while unknown.
  onProgress?: (percent: number | null) => void;
  isCancelled?: () => boolean;
  intervalMs?: number;
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  localStorage?: Pick<Storage, 'getItem'> | null;
}

const defaultWait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const MAX_STATUS_FAILURES = 3;

/**
 * Makes the study available to the viewer the way the work list does:
 * retrieves it from its PACS source and resolves as soon as the first series
 * is stored (the remaining job ids are handed to the viewer). When it cannot
 * be retrieved, a copy already in the local store is opened as it is.
 */
export async function prepareStudyForViewer({
  studyInstanceUID,
  repository,
  onProgress,
  isCancelled = () => false,
  intervalMs = RETRIEVE_JOBS_POLL_INTERVAL_MS,
  timeoutMs = RETRIEVE_JOBS_TIMEOUT_MS,
  wait = defaultWait,
  now = Date.now,
  sessionStorage,
  localStorage,
}: PrepareStudyOptions): Promise<OpenStudyOutcome> {
  // remainingJobIds: retrieval jobs still moving series when the wait is given
  // up; the viewer follows them if the partial copy is opened.
  const storedFallback = async (
    reason: OpenStudyFailure,
    remainingJobIds: string[] = []
  ): Promise<OpenStudyOutcome> => {
    let stored = false;
    try {
      stored = await repository.isStored(studyInstanceUID);
    } catch (error: unknown) {
      // Cannot tell: let the viewer try, it shows its own message if needed.
      stored = true;
    }
    if (isCancelled()) {
      return { status: 'cancelled' };
    }
    return stored
      ? { status: 'open', remainingJobIds, modalityId: null }
      : { status: 'failed', reason };
  };

  const resolved = await resolveSourceModality({
    studyInstanceUID,
    loadModalities: repository.loadModalities,
    ...(sessionStorage !== undefined ? { sessionStorage } : {}),
    ...(localStorage !== undefined ? { localStorage } : {}),
  });
  if (isCancelled()) {
    return { status: 'cancelled' };
  }
  if (!resolved) {
    return storedFallback('noSource');
  }
  const { modalityId } = resolved;
  // The viewer's "Refresh study from PACS" then uses the same source.
  rememberStudySourceModality(studyInstanceUID, modalityId, sessionStorage);

  let jobs: RetrieveJobRef[];
  try {
    jobs = await repository.retrieveStudy({ modalityId, studyInstanceUID });
  } catch (error: unknown) {
    return storedFallback('retrieveFailed');
  }
  if (isCancelled()) {
    return { status: 'cancelled' };
  }
  const jobIds = jobs.map(job => job.id).filter((id): id is string => !!id);
  if (!jobIds.length) {
    return { status: 'open', remainingJobIds: [], modalityId };
  }

  const firstIds = firstSeriesJobIds(jobs);
  const startedAt = now();
  let statusFailures = 0;
  // Jobs not yet finished, as last seen (all of them before the first answer).
  let unfinished = jobIds;
  const stillMoving = (infos: readonly RetrieveJobInfo[]) =>
    infos
      .filter(job => job.state !== 'Success' && job.state !== 'Failure' && job.progress !== 100)
      .map(job => job.id)
      .filter((id): id is string => !!id);
  onProgress?.(0);
  for (;;) {
    let infos: readonly RetrieveJobInfo[] | null = null;
    try {
      infos = await repository.loadJobs(jobIds);
      statusFailures = 0;
    } catch (error: unknown) {
      statusFailures += 1;
      if (statusFailures >= MAX_STATUS_FAILURES) {
        return storedFallback('retrieveFailed', unfinished);
      }
    }
    if (isCancelled()) {
      return { status: 'cancelled' };
    }
    if (infos) {
      unfinished = stillMoving(infos);
      const summary = summarizeRetrieveJobs(infos);
      onProgress?.(summary.overallProgress);
      if (summary.done || isReadyToOpen(infos, firstIds)) {
        const remainingJobIds = summary.done
          ? []
          : infos
              .filter(job => !(job.progress === 100 && job.state === 'Success'))
              .map(job => job.id)
              .filter((id): id is string => !!id);
        return { status: 'open', remainingJobIds, modalityId };
      }
      // The first series will not arrive: open what the store has, if anything.
      if (infos.some(job => firstIds.includes(job.id as string) && job.state === 'Failure')) {
        return storedFallback('retrieveFailed', unfinished);
      }
    }
    if (now() - startedAt >= timeoutMs) {
      return storedFallback('timedOut', unfinished);
    }
    await wait(intervalMs);
  }
}
