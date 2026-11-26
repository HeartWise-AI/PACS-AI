import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';
import { useOptionalInferenceProcessing } from '@pacs-ai/extension-core/src/inferenceProcessing/InferenceProcessingProvider';
import { pacsAiStudyContextService } from '@pacs-ai/extension-core/src/services/PacsAiStudyContextService';
import { STATE_CHANGED } from '@pacs-ai/extension-core/src/services/createStore';
import { inferenceStudyUIDs } from '../buildInferenceStudyModalities';
import {
  createViewerResultsRepository,
  isViewerResultsEndpointMissing,
  VIEWER_RESULTS_ERROR_CODES,
  ViewerResultsRequestError,
  type ViewerResultsRepository,
} from './viewerResultsRepository';
import {
  findDisplaySetsForSelectedView,
  findLatestResultForModel,
  findPendingRunEnd,
  findResultForPendingRun,
  findResultGroup,
  findRunResult,
  isSameResultRun,
  mergeResultRuns,
  withRunLabels,
  newestCompletedAt,
  resolveResultInput,
  resolveResultSeriesScope,
  resultFromPendingRun,
  viewerModelKey,
  viewerResultKey,
} from './viewerResultsModel';
import type {
  EndedViewerModelRun,
  PendingRunEnd,
  PendingRunFailure,
  PendingViewerModelRun,
  ResultSeriesScope,
  SelectedView,
  ViewerModelResult,
  ViewerModelRunStatus,
  ViewerResultModelIdentity,
} from './types';
import { ChatCitationHostContext, type ChatCitationHost } from '@pacs-ai/extension-chat/citations';
import {
  createModelExecutionResultClient,
  type ModelExecutionResultClient,
} from '../studyProcessing/executionResultClient';
import { resolveCitationResultActions } from './chatCitations';
import { getSafeCustomization } from '@pacs-ai/extension-core/src/ohifCompat/customization';
import { getActiveDisplaySets } from '@pacs-ai/extension-core/src/ohifCompat/displaySets';
import { getCachedUserAccess } from '@pacs-ai/extension-core/src/access/userAccessService';
import { Permission } from '@pacs-ai/extension-core/src/access/permissions';
import ViewerModelResultDrawer from './ViewerModelResultDrawer';
import ViewerModelResultReadyNotice from './ViewerModelResultReadyNotice';
import { ViewerRunningJobsIndicator } from '../runningJobs/ViewerRunningJobsIndicator';

export type LatestResultsStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export type ManagedRunOutcome = 'queued' | 'fallback';

export interface StartManagedRunRequest {
  model: ViewerResultModelIdentity;
  // DICOM modality, only for models that support several.
  modality?: string | null;
  // Series chosen in the series pop-up; study-service selects when absent.
  seriesInstanceUIDs?: string[];
  // Study chosen in the series pop-up; defaults to the viewer's study.
  studyInstanceUID?: string | null;
}

// How a run the user is waiting on ended. 'completed' means the provider
// has opened the result; 'dismissed' means the run continues in the
// background and its result is offered through the ready notice.
export type ForegroundRunOutcome =
  | { status: 'fallback' }
  | { status: 'completed'; result: ViewerModelResult }
  // The run ended without a result; `reason` is the backend's explanation.
  | { status: 'failed'; failure: PendingRunFailure; reason: string | null }
  | { status: 'timedOut' }
  | { status: 'dismissed' };

export interface OpenViewerModelResult {
  result: ViewerModelResult;
  minimized: boolean;
}

export interface ViewerModelResultsContextValue {
  canViewResults: boolean;
  canRunManaged: boolean;
  latestResultsStatus: LatestResultsStatus;
  refreshLatestResults: () => Promise<void>;
  // studyInstanceUID: one of the open exams; the primary exam when omitted.
  getLatestResult: (
    model: ViewerResultModelIdentity,
    studyInstanceUID?: string | null
  ) => ViewerModelResult | null;
  // The model's completed runs for the study, newest first. getLatestResult
  // returns the default one (the best run); the others stay reachable here.
  getResultRuns: (
    model: ViewerResultModelIdentity,
    studyInstanceUID?: string | null
  ) => ViewerModelResult[];
  // Which of the study's loaded series the result's run used; null when the
  // backend does not report it.
  getResultSeriesScope: (result: ViewerModelResult) => ResultSeriesScope | null;
  getPendingRun: (
    model: ViewerResultModelIdentity,
    studyInstanceUID?: string | null
  ) => PendingViewerModelRun | null;
  startManagedRun: (request: StartManagedRunRequest) => Promise<ManagedRunOutcome>;
  // Starts a managed run and resolves when it ends or is dismissed. Rejects
  // like startManagedRun when the run cannot be started.
  startForegroundRun: (request: StartManagedRunRequest) => Promise<ForegroundRunOutcome>;
  // Stops waiting on the foreground run; the run itself keeps going.
  dismissForegroundRun: () => void;
  openResult: (result: ViewerModelResult) => void;
  closeResult: () => void;
  setResultMinimized: (minimized: boolean) => void;
  openedResult: OpenViewerModelResult | null;
  loadSelectedView: (view: SelectedView) => boolean;
}

const ViewerModelResultsContext = createContext<ViewerModelResultsContextValue | null>(null);

// Returns null outside the viewer so shared components keep their previous
// behaviour when the provider is not mounted.
export function useViewerModelResults(): ViewerModelResultsContextValue | null {
  return useContext(ViewerModelResultsContext);
}

export const VIEWER_RESULTS_POLL_INTERVAL_MS = 10_000;
// While the user is waiting on a run in the series pop-up.
export const VIEWER_RESULTS_FOREGROUND_POLL_INTERVAL_MS = 3_000;
export const VIEWER_RESULTS_MAX_PENDING_MS = 30 * 60_000;
// Ended runs kept for the running-jobs indicator.
const ENDED_RUNS_LIMIT = 10;

const subscribeStudyContext = (onChange: () => void) =>
  pacsAiStudyContextService.subscribe(STATE_CHANGED, onChange).unsubscribe;

const getContextStudyUIDsKey = () =>
  inferenceStudyUIDs(pacsAiStudyContextService.getState().selectedModalities).join('\n');

export interface ViewerModelResultsProviderProps {
  children: React.ReactNode;
  // The primary exam (first in the URL).
  studyInstanceUID: string | null;
  // Every exam open in the viewer, primary included. Results are loaded for
  // all of them as soon as the viewer opens.
  studyInstanceUIDs?: readonly string[];
  servicesManager: AppTypes.ServicesManager;
  commandsManager?: unknown;
  appConfig?: unknown;
  repository?: ViewerResultsRepository;
  pollIntervalMs?: number;
  foregroundPollIntervalMs?: number;
  maxPendingMs?: number;
}

export function ViewerModelResultsProvider({
  children,
  studyInstanceUID,
  studyInstanceUIDs,
  servicesManager,
  commandsManager,
  appConfig,
  repository: providedRepository,
  pollIntervalMs = VIEWER_RESULTS_POLL_INTERVAL_MS,
  foregroundPollIntervalMs = VIEWER_RESULTS_FOREGROUND_POLL_INTERVAL_MS,
  maxPendingMs = VIEWER_RESULTS_MAX_PENDING_MS,
}: ViewerModelResultsProviderProps) {
  const { t } = useTranslation('AIModelButton');
  const showAlert = useContext(AlertContext) as
    | ((message: string, variant: string) => void)
    | undefined;
  const inferenceProcessing = useOptionalInferenceProcessing();
  const canViewResults = !!inferenceProcessing?.canViewStudyProcessingRunHistory;
  // Queued runs are only useful when their result can be viewed afterwards.
  const canRunManaged = canViewResults && !!inferenceProcessing?.canUseStudyProcessingREST;
  // Run labels can be changed with models.use (the backend also checks the
  // run's model). Access not loaded yet: let the backend decide.
  const cachedAccess = getCachedUserAccess();
  const canEditLabels =
    canViewResults && (!cachedAccess || cachedAccess.permissions.has(Permission.MODELS_USE));
  const repository = useMemo(
    () => providedRepository ?? createViewerResultsRepository(),
    [providedRepository]
  );

  const [latestResultsStatus, setLatestResultsStatus] = useState<LatestResultsStatus>('idle');
  const [latestResults, setLatestResults] = useState<ViewerModelResult[]>([]);
  const [pendingRuns, setPendingRuns] = useState<PendingViewerModelRun[]>([]);
  const [readyResults, setReadyResults] = useState<ViewerModelResult[]>([]);
  // Runs completed in this viewer session that the backend does not list (an
  // api-pacs or study-service without the run list): kept so the user can
  // still open them after looking at another run.
  const [unlistedRuns, setUnlistedRuns] = useState<ViewerModelResult[]>([]);
  // For the running-jobs indicator only: the last polled detail of each
  // pending run, and the runs that ended recently.
  const [pendingRunStatuses, setPendingRunStatuses] = useState<
    ReadonlyMap<PendingViewerModelRun, ViewerModelRunStatus>
  >(() => new Map());
  const [endedRuns, setEndedRuns] = useState<EndedViewerModelRun[]>([]);
  const [openedResult, setOpenedResult] = useState<OpenViewerModelResult | null>(null);
  const latestResultsRef = useRef<ViewerModelResult[]>([]);
  const pendingRunsRef = useRef<PendingViewerModelRun[]>([]);
  const refreshGeneration = useRef(0);
  // The run the user is waiting on in the series pop-up, if any.
  const foregroundRunRef = useRef<{
    run: PendingViewerModelRun;
    resolve: (outcome: ForegroundRunOutcome) => void;
  } | null>(null);
  const [foregroundRunActive, setForegroundRunActive] = useState(false);
  // A foreground run whose start request has not returned yet, and whether
  // the user stopped waiting in the meantime.
  const foregroundRunStarting = useRef<{ dismissed: boolean } | null>(null);
  const pollInFlight = useRef(false);

  latestResultsRef.current = latestResults;
  pendingRunsRef.current = pendingRuns;
  // Runs the user cancelled from the running-jobs indicator: a poll that was
  // already in flight must not report them as failed.
  const cancelledRunsRef = useRef(new WeakSet<PendingViewerModelRun>());
  // Runs whose cancellation was sent from the card and not yet answered.
  const cancellingRunsRef = useRef(new WeakSet<PendingViewerModelRun>());

  const alert = useCallback(
    (message: string, variant: 'error' | 'success' | 'info') => {
      if (typeof showAlert === 'function') {
        showAlert(message, variant);
      }
    },
    [showAlert]
  );

  // Subscribe only to the primitive UID key from study context so publishing
  // fresh selectedModalities/displaySets objects for the same exam(s) never
  // re-renders the viewer layout or study browser in a loop.
  const contextStudyKey = useSyncExternalStore(
    subscribeStudyContext,
    getContextStudyUIDsKey,
    getContextStudyUIDsKey
  );

  // The primary exam first, then the other open exams, without duplicates.
  const openStudyKey = [
    studyInstanceUID,
    ...(studyInstanceUIDs ?? []),
    ...(contextStudyKey ? contextStudyKey.split('\n') : []),
  ]
    .map(uid => uid?.trim())
    .filter((uid): uid is string => !!uid)
    .filter((uid, index, all) => all.indexOf(uid) === index)
    .join('\n');
  const openStudyUIDs = useMemo(
    () => (openStudyKey ? openStudyKey.split('\n') : []),
    [openStudyKey]
  );

  const refreshLatestResults = useCallback(async () => {
    if (!canViewResults || !openStudyUIDs.length) {
      return;
    }

    const generation = ++refreshGeneration.current;
    setLatestResultsStatus(current => (current === 'ready' ? current : 'loading'));
    // One request per open exam, in parallel; one exam failing does not hide
    // the others' results.
    const outcomes = await Promise.allSettled(
      openStudyUIDs.map(uid => repository.loadLatestResults(uid))
    );
    if (generation !== refreshGeneration.current) {
      return;
    }
    const loaded = outcomes.flatMap(outcome =>
      outcome.status === 'fulfilled' ? outcome.value : []
    );
    const failures = outcomes.flatMap(outcome =>
      outcome.status === 'rejected' ? [outcome.reason as unknown] : []
    );
    setLatestResults(loaded);
    if (failures.length < outcomes.length) {
      setLatestResultsStatus('ready');
    } else {
      // An older backend without the endpoint behaves as "no stored results".
      setLatestResultsStatus(
        failures.every(isViewerResultsEndpointMissing) ? 'unavailable' : 'error'
      );
    }
  }, [canViewResults, repository, openStudyUIDs]);

  useEffect(() => {
    // Different exams (or losing access) invalidate everything shown; load
    // the new exams' results right away instead of on the first menu open.
    refreshGeneration.current += 1;
    setLatestResults([]);
    setLatestResultsStatus('idle');
    setOpenedResult(null);
    setReadyResults([]);
    setUnlistedRuns([]);
    void refreshLatestResults();
  }, [refreshLatestResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const getLatestResult = useCallback(
    (model: ViewerResultModelIdentity, forStudyInstanceUID?: string | null) => {
      if (!canViewResults) {
        return null;
      }
      const study = forStudyInstanceUID?.trim() || studyInstanceUID?.trim();
      return findLatestResultForModel(
        model,
        latestResults.filter(result => result.studyInstanceUID === study)
      );
    },
    [canViewResults, latestResults, studyInstanceUID]
  );

  const getResultRuns = useCallback(
    (model: ViewerResultModelIdentity, forStudyInstanceUID?: string | null) =>
      mergeResultRuns(getLatestResult(model, forStudyInstanceUID), unlistedRuns),
    [getLatestResult, unlistedRuns]
  );

  const getPendingRun = useCallback(
    (model: ViewerResultModelIdentity, forStudyInstanceUID?: string | null) => {
      const study = forStudyInstanceUID?.trim() || studyInstanceUID?.trim();
      return (
        pendingRuns.find(
          run => run.key === viewerModelKey(model) && run.studyInstanceUID === study
        ) ?? null
      );
    },
    [pendingRuns, studyInstanceUID]
  );

  // Resolves the foreground wait when `run` is the run being waited on.
  const settleForegroundRun = useCallback(
    (run: PendingViewerModelRun | null, outcome: ForegroundRunOutcome): boolean => {
      const foreground = foregroundRunRef.current;
      if (!foreground || (run && foreground.run !== run)) {
        return false;
      }
      foregroundRunRef.current = null;
      setForegroundRunActive(false);
      foreground.resolve(outcome);
      return true;
    },
    []
  );

  const dismissForegroundRun = useCallback(() => {
    if (foregroundRunStarting.current) {
      foregroundRunStarting.current.dismissed = true;
    }
    settleForegroundRun(null, { status: 'dismissed' });
  }, [settleForegroundRun]);

  // Starts the run and tracks it as pending; null when the viewer has to
  // fall back to interactive predict.
  const beginManagedRun = useCallback(
    async ({
      model,
      modality,
      seriesInstanceUIDs,
      studyInstanceUID: requestedStudyInstanceUID,
    }: StartManagedRunRequest): Promise<PendingViewerModelRun | null> => {
      const modelRef = model.containerId?.trim() || model.modelId?.trim();
      const runStudyInstanceUID = requestedStudyInstanceUID?.trim() || studyInstanceUID?.trim();
      if (!canRunManaged || !modelRef || !runStudyInstanceUID) {
        return null;
      }

      const queue = (
        runId: string | null,
        executionId: string | null,
        name?: string | null,
        version?: string | null
      ) => {
        const reported = findLatestResultForModel(
          model,
          latestResultsRef.current.filter(result => result.studyInstanceUID === runStudyInstanceUID)
        );
        const pending: PendingViewerModelRun = {
          key: viewerModelKey(model),
          studyInstanceUID: runStudyInstanceUID,
          modelId: model.modelId?.trim() || null,
          containerId: model.containerId?.trim() || null,
          modelName: name ?? model.modelName,
          modelVersion: version ?? model.version ?? null,
          runId,
          executionId,
          requestedAt: Date.now(),
          // The newest of the model's runs, not the reported (best) one: the
          // run's result is recognized as the one completed after it.
          baselineCompletedAt: newestCompletedAt(reported),
          seriesInstanceUIDs: seriesInstanceUIDs?.length ? [...seriesInstanceUIDs] : null,
        };
        setPendingRuns(current => [
          ...current.filter(
            item =>
              !(item.key === pending.key && item.studyInstanceUID === pending.studyInstanceUID)
          ),
          pending,
        ]);
        return pending;
      };

      try {
        const run = await repository.runModel({
          studyInstanceUID: runStudyInstanceUID,
          modelRef,
          modality,
          ...(seriesInstanceUIDs?.length ? { seriesInstanceUIDs } : {}),
        });
        return queue(run.runId, run.executionId, run.modelName, run.modelVersion);
      } catch (error: unknown) {
        if (isViewerResultsEndpointMissing(error)) {
          return null;
        }
        const requestError = error instanceof ViewerResultsRequestError ? error : null;
        const errorCode = requestError?.errorCode ?? null;
        const status = requestError?.status ?? null;
        if (errorCode === VIEWER_RESULTS_ERROR_CODES.runAlreadyActive) {
          // Track the run that is already active so its result is offered
          // too, unless it is already tracked: a second click on Run must not
          // replace the run that carries the ids with one that has none.
          const tracked = pendingRunsRef.current.some(
            item =>
              item.key === viewerModelKey(model) && item.studyInstanceUID === runStudyInstanceUID
          );
          if (!tracked) {
            queue(null, null);
          }
          throw new ViewerResultsRequestError(t('ViewerRunAlreadyActive'), status, errorCode);
        }
        if (errorCode === VIEWER_RESULTS_ERROR_CODES.studyNotAvailableLocally) {
          throw new ViewerResultsRequestError(
            t('ViewerStudyNotAvailableLocally'),
            status,
            errorCode
          );
        }
        if (status === 429) {
          throw new ViewerResultsRequestError(t('ViewerRunQuotaExceeded'), status, errorCode);
        }
        throw new ViewerResultsRequestError(
          requestError?.serverMessage ?? t('ViewerRunFailed'),
          status,
          errorCode
        );
      }
    },
    [canRunManaged, repository, studyInstanceUID, t]
  );

  const startManagedRun = useCallback(
    async (request: StartManagedRunRequest): Promise<ManagedRunOutcome> => {
      const pending = await beginManagedRun(request);
      if (!pending) {
        return 'fallback';
      }
      alert(t('ViewerRunQueued', { modelName: pending.modelName }), 'info');
      return 'queued';
    },
    [alert, beginManagedRun, t]
  );

  const startForegroundRun = useCallback(
    async (request: StartManagedRunRequest): Promise<ForegroundRunOutcome> => {
      const starting = { dismissed: false };
      foregroundRunStarting.current = starting;
      let pending: PendingViewerModelRun | null;
      try {
        pending = await beginManagedRun(request);
      } finally {
        if (foregroundRunStarting.current === starting) {
          foregroundRunStarting.current = null;
        }
      }
      if (!pending) {
        return { status: 'fallback' };
      }
      if (starting.dismissed) {
        return { status: 'dismissed' };
      }
      // Only one run is waited on at a time.
      settleForegroundRun(null, { status: 'dismissed' });
      return new Promise<ForegroundRunOutcome>(resolve => {
        foregroundRunRef.current = { run: pending, resolve };
        setForegroundRunActive(true);
      });
    },
    [beginManagedRun, settleForegroundRun]
  );

  const pollPendingRuns = useCallback(async () => {
    const pending = pendingRunsRef.current;
    if (!pending.length || pollInFlight.current) {
      return;
    }

    pollInFlight.current = true;
    try {
      const studies = [...new Set(pending.map(run => run.studyInstanceUID))];
      const resultsByStudy = new Map<string, ViewerModelResult[]>();
      const loadStudyResults = (uid: string) =>
        repository.loadLatestResults(uid).then(
          results => {
            resultsByStudy.set(uid, results);
          },
          () => {
            // Transient failures are retried on the next tick.
          }
        );

      // The run detail says when a run has ended and how. The latest results
      // cannot: they report the model's best run, which stays an earlier run
      // when that one used more videos than the run just requested.
      const statuses = new Map<PendingViewerModelRun, ViewerModelRunStatus>();
      const ends = new Map<PendingViewerModelRun, PendingRunEnd>();
      await Promise.all([
        ...studies.map(loadStudyResults),
        ...pending
          .filter(run => run.runId)
          .map(run =>
            repository.loadRunStatus(run.runId as string).then(
              status => {
                statuses.set(run, status);
                const end = findPendingRunEnd(status, run);
                if (end) {
                  ends.set(run, end);
                }
              },
              (error: unknown) => {
                // A run the backend no longer knows will never report anything;
                // other failures keep the run tracked until it times out.
                if (
                  error instanceof ViewerResultsRequestError &&
                  error.status === 404 &&
                  error.errorCode
                ) {
                  ends.set(run, { kind: 'failed', reason: null });
                }
              }
            )
          ),
      ]);

      const storedResult = (run: PendingViewerModelRun) =>
        findResultForPendingRun(run, resultsByStudy.get(run.studyInstanceUID) ?? []);
      // A run that completed after its study's results were read is listed
      // by a second read.
      const unlisted = studies.filter(uid =>
        pending.some(
          run =>
            run.studyInstanceUID === uid &&
            ends.get(run)?.kind === 'completed' &&
            !storedResult(run)
        )
      );
      await Promise.all(unlisted.map(loadStudyResults));

      // Replace the reloaded open exams' results; keep the other exams' ones.
      const reloadedOpenStudies = openStudyUIDs.filter(uid => resultsByStudy.has(uid));
      if (reloadedOpenStudies.length && canViewResults) {
        refreshGeneration.current += 1;
        setLatestResults(current => [
          ...current.filter(result => !reloadedOpenStudies.includes(result.studyInstanceUID)),
          ...reloadedOpenStudies.flatMap(uid => resultsByStudy.get(uid) ?? []),
        ]);
        setLatestResultsStatus('ready');
      }

      const now = Date.now();
      const completed = new Map<PendingViewerModelRun, ViewerModelResult>();
      const failed = new Map<
        PendingViewerModelRun,
        { failure: PendingRunFailure; reason: string | null }
      >();
      const timedOut: PendingViewerModelRun[] = [];
      const stillPending = pending.filter(run => {
        const end = ends.get(run);
        const stored = storedResult(run);
        if (stored) {
          completed.set(run, stored);
          return false;
        }
        if (end?.kind === 'completed') {
          // Completed, but not listed by this backend: open the run's own
          // report from its ids instead of waiting for the reported result
          // to change, which it never does when an earlier run stays best.
          const execution = statuses.get(run)?.executions;
          const provisional = resultFromPendingRun(
            {
              ...run,
              executionId:
                run.executionId ?? (execution?.length === 1 ? execution[0].executionId : null),
            },
            end.completedAt,
            findLatestResultForModel(
              {
                modelId: run.modelId,
                containerId: run.containerId,
                modelName: run.modelName,
                version: run.modelVersion,
              },
              resultsByStudy.get(run.studyInstanceUID) ?? []
            )
          );
          if (provisional) {
            completed.set(run, provisional);
            return false;
          }
        }
        // A cancellation awaiting its answer settles the run itself.
        if (end && end.kind !== 'completed' && !cancellingRunsRef.current.has(run)) {
          failed.set(run, { failure: end.kind, reason: end.reason });
          return false;
        }
        if (now - run.requestedAt > maxPendingMs) {
          timedOut.push(run);
          return false;
        }
        return true;
      });

      // A run whose detail could not be loaded this time keeps its last one.
      setPendingRunStatuses(current => {
        const next = new Map<PendingViewerModelRun, ViewerModelRunStatus>();
        stillPending.forEach(run => {
          const status = statuses.get(run) ?? current.get(run);
          if (status) {
            next.set(run, status);
          }
        });
        return next;
      });

      if (stillPending.length === pending.length) {
        return;
      }

      setPendingRuns(current =>
        current.filter(run => stillPending.includes(run) || !pending.includes(run))
      );

      const ready: ViewerModelResult[] = [];
      const ended: EndedViewerModelRun[] = [];
      completed.forEach((result, run) => {
        const foreground = settleForegroundRun(run, { status: 'completed', result });
        if (foreground) {
          // The user is waiting on this run: show its result right away.
          setOpenedResult({ result, minimized: false });
        } else {
          ready.push(result);
        }
        ended.push({ run, outcome: 'completed', result, endedAt: now, foreground });
      });
      const provisional = [...completed.values()].filter(result => result.provisional);
      if (provisional.length) {
        setUnlistedRuns(current => [
          ...current.filter(item => !provisional.some(result => isSameResultRun(result, item))),
          ...provisional,
        ]);
      }
      if (ready.length) {
        setReadyResults(current => [
          ...current.filter(
            item => !ready.some(result => viewerResultKey(result) === viewerResultKey(item))
          ),
          ...ready,
        ]);
      }
      failed.forEach(({ failure, reason }, run) => {
        if (cancelledRunsRef.current.has(run)) {
          return;
        }
        const foreground = settleForegroundRun(run, { status: 'failed', failure, reason });
        ended.push({ run, outcome: failure, reason, result: null, endedAt: now, foreground });
        const messageKey =
          failure === 'cancelled'
            ? 'ViewerRunEndedCancelled'
            : failure === 'skipped'
              ? reason
                ? 'ViewerRunEndedSkippedReason'
                : 'ViewerRunEndedSkipped'
              : reason
                ? 'ViewerRunEndedFailedReason'
                : 'ViewerRunEndedFailed';
        alert(
          t(messageKey, { modelName: run.modelName, reason }),
          failure === 'cancelled' ? 'info' : 'error'
        );
      });
      timedOut.forEach(run => {
        settleForegroundRun(run, { status: 'timedOut' });
        alert(t('ViewerRunStillRunning', { modelName: run.modelName }), 'info');
      });
      if (ended.length) {
        setEndedRuns(current => [...current, ...ended].slice(-ENDED_RUNS_LIMIT));
      }
    } finally {
      pollInFlight.current = false;
    }
  }, [alert, canViewResults, maxPendingMs, repository, settleForegroundRun, openStudyUIDs, t]);

  // Poll faster while the user is waiting on a run in the series pop-up.
  const activePollIntervalMs = foregroundRunActive
    ? Math.min(pollIntervalMs, foregroundPollIntervalMs)
    : pollIntervalMs;

  useEffect(() => {
    if (!pendingRuns.length) {
      return;
    }
    const interval = window.setInterval(() => {
      void pollPendingRuns();
    }, activePollIntervalMs);
    return () => window.clearInterval(interval);
  }, [pendingRuns.length, activePollIntervalMs, pollPendingRuns]);

  const openResult = useCallback(
    (result: ViewerModelResult) => {
      if (!canViewResults) {
        return;
      }
      setOpenedResult({ result, minimized: false });
      setReadyResults(current =>
        current.filter(item => viewerResultKey(item) !== viewerResultKey(result))
      );
    },
    [canViewResults]
  );

  const closeResult = useCallback(() => setOpenedResult(null), []);

  // A run's labels changed in the drawer: shown at once everywhere the run is
  // listed, without waiting for the next latest-results refresh.
  const handleRunLabelsChanged = useCallback((run: ViewerModelResult, labels: string[]) => {
    setLatestResults(current => withRunLabels(current, run, labels));
    setUnlistedRuns(current => withRunLabels(current, run, labels));
    setOpenedResult(current =>
      current && isSameResultRun(current.result, run)
        ? { ...current, result: { ...current.result, labels } }
        : current
    );
  }, []);

  // A result opened from a run that had just completed is replaced by the
  // listed one (selected views, video counts) once the backend reports it.
  useEffect(() => {
    setUnlistedRuns(current => {
      const kept = current.filter(
        run =>
          !findRunResult(
            latestResults.filter(result => result.studyInstanceUID === run.studyInstanceUID),
            { executionId: run.executionId, runId: run.runId, modelName: run.modelName }
          )
      );
      return kept.length === current.length ? current : kept;
    });
    setOpenedResult(current => {
      if (!current?.result.provisional) {
        return current;
      }
      const listed = findRunResult(
        latestResults.filter(result => result.studyInstanceUID === current.result.studyInstanceUID),
        {
          executionId: current.result.executionId,
          runId: current.result.runId,
          modelName: current.result.modelName,
        }
      );
      return listed ? { ...current, result: listed } : current;
    });
  }, [latestResults]);

  // The runs offered in the open drawer: the opened result's model's runs,
  // with the opened result itself when the backend does not list it.
  const openedRuns = useMemo(() => {
    const opened = openedResult?.result;
    if (!opened) {
      return [];
    }
    const runs = mergeResultRuns(findResultGroup(opened, latestResults), unlistedRuns);
    return runs.some(run => isSameResultRun(run, opened)) ? runs : [opened, ...runs];
  }, [openedResult, latestResults, unlistedRuns]);

  const setResultMinimized = useCallback(
    (minimized: boolean) =>
      setOpenedResult(current => (current ? { ...current, minimized } : current)),
    []
  );

  const getResultSeriesScope = useCallback(
    (result: ViewerModelResult): ResultSeriesScope | null =>
      resolveResultSeriesScope(
        result,
        getActiveDisplaySets(servicesManager.services.displaySetService)
      ),
    [servicesManager]
  );

  // The scope shown in the open drawer depends on the loaded display sets,
  // which can still be arriving when a result is opened.
  const [, setDisplaySetsVersion] = useState(0);
  const resultIsOpen = !!openedResult && !openedResult.minimized;
  useEffect(() => {
    const displaySetService = servicesManager.services.displaySetService;
    const event = displaySetService?.EVENTS?.DISPLAY_SETS_ADDED;
    if (!resultIsOpen || !event || typeof displaySetService.subscribe !== 'function') {
      return undefined;
    }
    const subscription = displaySetService.subscribe(event, () =>
      setDisplaySetsVersion(version => version + 1)
    );
    return () => subscription?.unsubscribe?.();
  }, [resultIsOpen, servicesManager]);

  const loadSelectedView = useCallback(
    (view: SelectedView): boolean => {
      const { displaySetService, viewportGridService, customizationService } =
        servicesManager.services;
      const [displaySet] = findDisplaySetsForSelectedView(
        view,
        getActiveDisplaySets(displaySetService)
      );
      if (!displaySet) {
        alert(t('ViewerSelectedViewNotLoaded'), 'info');
        return false;
      }

      // Reuse the study browser's double-click behaviour so the clip loads
      // exactly as if the thumbnail had been double-clicked.
      const { activeViewportId, isHangingProtocolLayout } = viewportGridService.getState();
      const customization = getSafeCustomization<{
        callbacks?: Array<(args: unknown) => (uid: string) => Promise<void> | void>;
      }>(customizationService, 'studyBrowser.thumbnailDoubleClickCallback');
      const setupArgs = {
        activeViewportId,
        commandsManager,
        servicesManager,
        isHangingProtocolLayout,
        appConfig,
      };
      const handlers = (customization?.callbacks ?? []).map(callback => callback(setupArgs));
      void handlers.reduce<Promise<void>>(
        (previous, handler) =>
          previous.then(() => handler(displaySet.displaySetInstanceUID) as Promise<void>),
        Promise.resolve()
      );
      return true;
    },
    [alert, appConfig, commandsManager, servicesManager, t]
  );

  // The indicator cancelled a pending run: stop tracking it, without the
  // "run failed" alert, and let its row end as cancelled.
  const handleRunCancelled = useCallback((run: PendingViewerModelRun) => {
    cancellingRunsRef.current.delete(run);
    if (cancelledRunsRef.current.has(run) || !pendingRunsRef.current.includes(run)) {
      // Already settled (a result arrived, or it was cancelled before).
      return;
    }
    cancelledRunsRef.current.add(run);
    setPendingRuns(current => current.filter(item => item !== run));
    setEndedRuns(current =>
      [
        ...current,
        {
          run,
          outcome: 'cancelled' as const,
          result: null,
          endedAt: Date.now(),
          foreground: false,
        },
      ].slice(-ENDED_RUNS_LIMIT)
    );
  }, []);

  const handleRunCancelStarted = useCallback((run: PendingViewerModelRun) => {
    cancellingRunsRef.current.add(run);
  }, []);
  const handleRunCancelAbandoned = useCallback((run: PendingViewerModelRun) => {
    cancellingRunsRef.current.delete(run);
  }, []);

  // The chat's citation chips ("[1]") open the cited result through this.
  const executionResultClientRef = useRef<ModelExecutionResultClient | null>(null);
  const citationHost = useMemo<ChatCitationHost>(() => {
    const results = [...latestResults, ...readyResults];
    return {
      resolveModelResult: citation =>
        resolveCitationResultActions(citation, {
          canViewResults,
          results,
          resultsLoading: latestResultsStatus === 'idle' || latestResultsStatus === 'loading',
          openResult,
          loadExecutionResult: async request => {
            executionResultClientRef.current ??= createModelExecutionResultClient();
            const loaded = await executionResultClientRef.current.loadExecutionResult(request);
            return loaded.result;
          },
        }),
      // The cited result may be newer than the results loaded so far.
      onModelResultShown: () => void refreshLatestResults(),
    };
  }, [
    canViewResults,
    latestResults,
    readyResults,
    latestResultsStatus,
    openResult,
    refreshLatestResults,
  ]);

  const value = useMemo<ViewerModelResultsContextValue>(
    () => ({
      canViewResults,
      canRunManaged,
      latestResultsStatus,
      refreshLatestResults,
      getLatestResult,
      getResultRuns,
      getResultSeriesScope,
      getPendingRun,
      startManagedRun,
      startForegroundRun,
      dismissForegroundRun,
      openResult,
      closeResult,
      setResultMinimized,
      openedResult,
      loadSelectedView,
    }),
    [
      canViewResults,
      canRunManaged,
      latestResultsStatus,
      refreshLatestResults,
      getLatestResult,
      getResultRuns,
      getResultSeriesScope,
      getPendingRun,
      startManagedRun,
      startForegroundRun,
      dismissForegroundRun,
      openResult,
      closeResult,
      setResultMinimized,
      openedResult,
      loadSelectedView,
    ]
  );

  return (
    <ViewerModelResultsContext.Provider value={value}>
      <ChatCitationHostContext.Provider value={citationHost}>
        {children}
      </ChatCitationHostContext.Provider>
      {openedResult && !openedResult.minimized && (
        <ViewerModelResultDrawer
          result={openedResult.result}
          seriesScope={getResultSeriesScope(openedResult.result)}
          input={resolveResultInput(
            openedResult.result,
            getActiveDisplaySets(servicesManager.services.displaySetService)
          )}
          runs={openedRuns}
          onSelectRun={openResult}
          canEditLabels={canEditLabels}
          onRunLabelsChanged={handleRunLabelsChanged}
          repository={repository}
          onClose={closeResult}
          onMinimize={() => setResultMinimized(true)}
          onSelectView={loadSelectedView}
        />
      )}
      {canViewResults && (
        <ViewerModelResultReadyNotice
          results={readyResults}
          onView={openResult}
          onDismiss={result =>
            setReadyResults(current =>
              current.filter(item => viewerResultKey(item) !== viewerResultKey(result))
            )
          }
        />
      )}
      <ViewerRunningJobsIndicator
        studyInstanceUID={studyInstanceUID}
        pendingRuns={pendingRuns}
        pendingRunStatuses={pendingRunStatuses}
        endedRuns={endedRuns}
        foregroundRun={foregroundRunActive ? (foregroundRunRef.current?.run ?? null) : null}
        onOpenResult={openResult}
        onRunCancelled={handleRunCancelled}
        onRunCancelStarted={handleRunCancelStarted}
        onRunCancelAbandoned={handleRunCancelAbandoned}
        besideReadyNotice={canViewResults && readyResults.length > 0}
      />
    </ViewerModelResultsContext.Provider>
  );
}

export default ViewerModelResultsProvider;
