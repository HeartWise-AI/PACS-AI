import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pollRetrieveJobs,
  RetrieveJobsError,
  type RetrieveJobInfo,
  type RetrieveJobsSummary,
} from './retrieveJobs';
import { resolveSourceModality, type SourceModalities } from './sourceModality';
import type { StudySeriesSnapshot } from './reloadStudySeries';

export type StudyRefreshPhase =
  | 'idle'
  | 'resolving'
  | 'retrieving'
  | 'reloading'
  | 'done'
  | 'error';

export type StudyRefreshError =
  // The PACS retrieval could not be started, or a retrieval job failed.
  | 'retrieveFailed'
  | 'retrieveTimedOut'
  // The viewer could not reload the series of the local copy.
  | 'reloadFailed';

export interface StudyRefreshResult {
  newSeries: number;
  newImages: number;
  // False when the PACS source is unknown: only the local copy was reloaded.
  retrievedFromPACS: boolean;
}

export interface StudyRefreshState {
  phase: StudyRefreshPhase;
  // Percentage of the retrieval; null while it is not known.
  progress: number | null;
  // What the reload changed; set when it ran, also after a failed retrieval.
  result: StudyRefreshResult | null;
  error: StudyRefreshError | null;
}

export interface StudyRefreshRepository {
  loadModalities: () => Promise<SourceModalities | null | undefined>;
  // Resolves the retrieval job ids; an empty list when the local copy already
  // has every series of the PACS.
  retrieveStudy: (request: { modalityId: string; studyInstanceUID: string }) => Promise<string[]>;
  loadJobs: (jobIds: string[]) => Promise<readonly RetrieveJobInfo[]>;
}

export interface UseStudyRefreshOptions {
  studyInstanceUID: string | null;
  repository: StudyRefreshRepository;
  // Reloads the study's series in the viewer.
  reloadSeries: (studyInstanceUID: string) => Promise<void>;
  getSeriesSnapshot: (studyInstanceUID: string) => StudySeriesSnapshot;
  sessionStorage?: Pick<Storage, 'getItem'> | null;
  localStorage?: Pick<Storage, 'getItem'> | null;
  pollIntervalMs?: number;
  timeoutMs?: number;
  // How long "3 new series" / "Up to date" stays before the button is idle again.
  resultLingerMs?: number;
  wait?: (ms: number) => Promise<void>;
}

export interface StudyRefreshController {
  state: StudyRefreshState;
  busy: boolean;
  refresh: () => Promise<void>;
}

export const STUDY_REFRESH_RESULT_LINGER_MS = 6_000;

const IDLE: StudyRefreshState = { phase: 'idle', progress: null, result: null, error: null };

export function isStudyRefreshBusy(phase: StudyRefreshPhase): boolean {
  return phase === 'resolving' || phase === 'retrieving' || phase === 'reloading';
}

export function countStudyChanges(
  before: StudySeriesSnapshot,
  after: StudySeriesSnapshot
): Pick<StudyRefreshResult, 'newSeries' | 'newImages'> {
  const known = new Set(before.seriesInstanceUIDs);
  return {
    newSeries: new Set(after.seriesInstanceUIDs.filter(uid => !known.has(uid))).size,
    newImages: Math.max(0, after.instances - before.instances),
  };
}

/**
 * "Refresh study from PACS": retrieves the study from its PACS source into the
 * local store, waits for the retrieval jobs, then reloads the study's series
 * in the viewer. When the source is unknown only the reload is done; when the
 * retrieval fails the reload is still done and the failure reported.
 */
export function useStudyRefresh({
  studyInstanceUID,
  repository,
  reloadSeries,
  getSeriesSnapshot,
  sessionStorage,
  localStorage,
  pollIntervalMs,
  timeoutMs,
  resultLingerMs = STUDY_REFRESH_RESULT_LINGER_MS,
  wait,
}: UseStudyRefreshOptions): StudyRefreshController {
  const [state, setState] = useState<StudyRefreshState>(IDLE);
  // Bumped when the study changes or the component goes away: a refresh of a
  // previous generation stops reporting.
  const generation = useRef(0);
  const running = useRef(false);
  const latest = useRef({ repository, reloadSeries, getSeriesSnapshot });
  latest.current = { repository, reloadSeries, getSeriesSnapshot };
  const uid = studyInstanceUID?.trim() || null;

  useEffect(() => {
    setState(IDLE);
    return () => {
      generation.current += 1;
      running.current = false;
    };
  }, [uid]);

  useEffect(() => {
    if (state.phase !== 'done' || resultLingerMs <= 0) {
      return undefined;
    }
    const timeout = window.setTimeout(
      () => setState(current => (current.phase === 'done' ? IDLE : current)),
      resultLingerMs
    );
    return () => window.clearTimeout(timeout);
  }, [state.phase, resultLingerMs]);

  const refresh = useCallback(async () => {
    if (!uid || running.current) {
      return;
    }
    running.current = true;
    const run = generation.current;
    const stale = () => run !== generation.current;
    const report = (next: StudyRefreshState) => {
      if (!stale()) {
        setState(next);
      }
    };
    const { repository: api, reloadSeries: reload, getSeriesSnapshot: snapshot } = latest.current;

    // Each step catches its own failure: 'stale' ends the refresh quietly.
    const retrieveFromPACS = async (
      modalityId: string
    ): Promise<StudyRefreshError | 'stale' | null> => {
      try {
        const jobIds = await api.retrieveStudy({ modalityId, studyInstanceUID: uid });
        const completed = await pollRetrieveJobs({
          jobIds,
          loadJobs: api.loadJobs,
          onProgress: (summary: RetrieveJobsSummary) =>
            report({
              phase: 'retrieving',
              progress: summary.total ? summary.averageProgress : null,
              result: null,
              error: null,
            }),
          isCancelled: stale,
          ...(pollIntervalMs !== undefined ? { intervalMs: pollIntervalMs } : {}),
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          ...(wait ? { wait } : {}),
        });
        return completed ? null : 'stale';
      } catch (retrieveFailure: unknown) {
        return retrieveFailure instanceof RetrieveJobsError && retrieveFailure.reason === 'timedOut'
          ? 'retrieveTimedOut'
          : 'retrieveFailed';
      }
    };

    const reloadAndCount = async (): Promise<Pick<
      StudyRefreshResult,
      'newSeries' | 'newImages'
    > | null> => {
      try {
        const before = snapshot(uid);
        await reload(uid);
        return countStudyChanges(before, snapshot(uid));
      } catch (reloadFailure: unknown) {
        return null;
      }
    };

    const steps = async () => {
      report({ phase: 'resolving', progress: null, result: null, error: null });
      const source = await resolveSourceModality({
        studyInstanceUID: uid,
        loadModalities: api.loadModalities,
        ...(sessionStorage !== undefined ? { sessionStorage } : {}),
        ...(localStorage !== undefined ? { localStorage } : {}),
      });
      if (stale()) {
        return;
      }

      let retrieveError: StudyRefreshError | null = null;
      if (source) {
        report({ phase: 'retrieving', progress: null, result: null, error: null });
        const outcome = await retrieveFromPACS(source.modalityId);
        if (outcome === 'stale' || stale()) {
          return;
        }
        retrieveError = outcome;
      }

      report({ phase: 'reloading', progress: null, result: null, error: null });
      const changes = await reloadAndCount();
      if (!changes) {
        report({ phase: 'error', progress: null, result: null, error: 'reloadFailed' });
        return;
      }
      const result: StudyRefreshResult = {
        ...changes,
        retrievedFromPACS: !!source && !retrieveError,
      };
      report(
        retrieveError
          ? { phase: 'error', progress: null, result, error: retrieveError }
          : { phase: 'done', progress: null, result, error: null }
      );
    };

    try {
      await steps();
    } catch (unexpected: unknown) {
      report({ phase: 'error', progress: null, result: null, error: 'reloadFailed' });
    } finally {
      if (!stale()) {
        running.current = false;
      }
    }
  }, [uid, sessionStorage, localStorage, pollIntervalMs, timeoutMs, wait]);

  return { state, busy: isStudyRefreshBusy(state.phase), refresh };
}
