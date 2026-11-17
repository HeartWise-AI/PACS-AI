// "Retrieve from PACS and open" for exams whose images the local store no
// longer has (they are removed about 24 hours after they arrive). It is the
// flow of the viewer's "Refresh study from PACS": the PACS source of the
// study is resolved, POST /v1/orthanc/modality/retrieve starts the retrieval
// and /v1/orthanc/jobs is polled until every job completed.

import {
  pollRetrieveJobs,
  RetrieveJobsError,
  type RetrieveJobsFailure,
} from '../../components/inference/studyRefresh/retrieveJobs';
import {
  rememberStudySourceModality,
  resolveSourceModality,
  type SourceModalities,
} from '../../components/inference/studyRefresh/sourceModality';
import type { StudyRefreshRepository } from '../../components/inference/studyRefresh/useStudyRefresh';

export type ExamRetrievalFailure = RetrieveJobsFailure | 'startFailed';

export class ExamRetrievalError extends Error {
  readonly reason: ExamRetrievalFailure;

  constructor(reason: ExamRetrievalFailure) {
    super(`Exam retrieval ${reason}`);
    this.name = 'ExamRetrievalError';
    this.reason = reason;
  }
}

export interface ExamRetriever {
  /** The PACS source to retrieve the exam from, or null when none can be resolved. */
  source(studyInstanceUID: string): Promise<string | null>;
  /**
   * Retrieves the exam into the local store. onProgress receives the
   * percentage (null while unknown). Rejects with ExamRetrievalError.
   */
  retrieve(
    studyInstanceUID: string,
    modalityId: string,
    onProgress: (percent: number | null) => void,
    isCancelled?: () => boolean
  ): Promise<boolean>;
}

export interface ExamRetrieverOptions {
  intervalMs?: number;
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  localStorage?: Pick<Storage, 'getItem'> | null;
}

export function createExamRetriever(
  repository: StudyRefreshRepository,
  options: ExamRetrieverOptions = {}
): ExamRetriever {
  // The tenant's PACS sources are listed once per page; a failed listing is retried.
  let modalities: Promise<SourceModalities | null | undefined> | null = null;
  const loadModalities = () => {
    if (!modalities) {
      modalities = repository.loadModalities();
      modalities.catch(() => {
        modalities = null;
      });
    }
    return modalities;
  };

  return {
    async source(studyInstanceUID) {
      const resolved = await resolveSourceModality({
        studyInstanceUID,
        loadModalities,
        ...(options.sessionStorage !== undefined ? { sessionStorage: options.sessionStorage } : {}),
        ...(options.localStorage !== undefined ? { localStorage: options.localStorage } : {}),
      });
      return resolved?.modalityId ?? null;
    },
    async retrieve(studyInstanceUID, modalityId, onProgress, isCancelled) {
      let jobIds: string[];
      try {
        jobIds = await repository.retrieveStudy({ modalityId, studyInstanceUID });
      } catch (error: unknown) {
        throw new ExamRetrievalError('startFailed');
      }
      try {
        const completed = await pollRetrieveJobs({
          jobIds,
          loadJobs: repository.loadJobs,
          onProgress: summary => onProgress(summary.total ? summary.averageProgress : null),
          ...(isCancelled ? { isCancelled } : {}),
          ...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {}),
          ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
          ...(options.wait ? { wait: options.wait } : {}),
        });
        if (completed) {
          // The viewer's "Refresh study from PACS" then knows the source.
          rememberStudySourceModality(
            studyInstanceUID,
            modalityId,
            options.sessionStorage === undefined ? undefined : options.sessionStorage
          );
        }
        return completed;
      } catch (error: unknown) {
        throw new ExamRetrievalError(error instanceof RetrieveJobsError ? error.reason : 'failed');
      }
    },
  };
}
