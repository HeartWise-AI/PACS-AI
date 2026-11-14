import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { AlertContext } from '../../../AlertProvider';
import { useOptionalInferenceProcessing } from '../InferenceProcessingProvider';
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
  isResultForPendingRun,
  viewerModelKey,
  viewerResultKey,
} from './viewerResultsModel';
import type {
  PendingViewerModelRun,
  SelectedView,
  ViewerModelResult,
  ViewerResultModelIdentity,
} from './types';
import ViewerModelResultDrawer from './ViewerModelResultDrawer';
import ViewerModelResultReadyNotice from './ViewerModelResultReadyNotice';

export type LatestResultsStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export type ManagedRunOutcome = 'queued' | 'fallback';

export interface StartManagedRunRequest {
  model: ViewerResultModelIdentity;
  studyInstanceUID: string;
  seriesInstanceUIDs: string[];
}

export interface OpenViewerModelResult {
  result: ViewerModelResult;
  minimized: boolean;
}

export interface ViewerModelResultsContextValue {
  canViewResults: boolean;
  canRunManaged: boolean;
  latestResultsStatus: LatestResultsStatus;
  refreshLatestResults: () => Promise<void>;
  getLatestResult: (model: ViewerResultModelIdentity) => ViewerModelResult | null;
  getPendingRun: (model: ViewerResultModelIdentity) => PendingViewerModelRun | null;
  startManagedRun: (request: StartManagedRunRequest) => Promise<ManagedRunOutcome>;
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
export const VIEWER_RESULTS_MAX_PENDING_MS = 30 * 60_000;

export interface ViewerModelResultsProviderProps {
  children: React.ReactNode;
  studyInstanceUID: string | null;
  servicesManager: AppTypes.ServicesManager;
  commandsManager?: unknown;
  appConfig?: unknown;
  repository?: ViewerResultsRepository;
  pollIntervalMs?: number;
  maxPendingMs?: number;
}

export function ViewerModelResultsProvider({
  children,
  studyInstanceUID,
  servicesManager,
  commandsManager,
  appConfig,
  repository: providedRepository,
  pollIntervalMs = VIEWER_RESULTS_POLL_INTERVAL_MS,
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
  const repository = useMemo(
    () => providedRepository ?? createViewerResultsRepository(),
    [providedRepository]
  );

  const [latestResultsStatus, setLatestResultsStatus] = useState<LatestResultsStatus>('idle');
  const [latestResults, setLatestResults] = useState<ViewerModelResult[]>([]);
  const [pendingRuns, setPendingRuns] = useState<PendingViewerModelRun[]>([]);
  const [readyResults, setReadyResults] = useState<ViewerModelResult[]>([]);
  const [openedResult, setOpenedResult] = useState<OpenViewerModelResult | null>(null);
  const latestResultsRef = useRef<ViewerModelResult[]>([]);
  const pendingRunsRef = useRef<PendingViewerModelRun[]>([]);
  const refreshGeneration = useRef(0);

  latestResultsRef.current = latestResults;
  pendingRunsRef.current = pendingRuns;

  const alert = useCallback(
    (message: string, variant: 'error' | 'success' | 'info') => {
      if (typeof showAlert === 'function') {
        showAlert(message, variant);
      }
    },
    [showAlert]
  );

  const refreshLatestResults = useCallback(async () => {
    const uid = studyInstanceUID?.trim();
    if (!canViewResults || !uid) {
      return;
    }

    const generation = ++refreshGeneration.current;
    setLatestResultsStatus(current => (current === 'ready' ? current : 'loading'));
    try {
      const results = await repository.loadLatestResults(uid);
      if (generation === refreshGeneration.current) {
        setLatestResults(results);
        setLatestResultsStatus('ready');
      }
    } catch (error: unknown) {
      if (generation !== refreshGeneration.current) {
        return;
      }
      // An older backend without the endpoint behaves as "no stored results".
      setLatestResults([]);
      setLatestResultsStatus(isViewerResultsEndpointMissing(error) ? 'unavailable' : 'error');
    }
  }, [canViewResults, repository, studyInstanceUID]);

  useEffect(() => {
    // A different study (or losing access) invalidates everything shown.
    refreshGeneration.current += 1;
    setLatestResults([]);
    setLatestResultsStatus('idle');
    setOpenedResult(null);
    setReadyResults([]);
  }, [studyInstanceUID, canViewResults]);

  const getLatestResult = useCallback(
    (model: ViewerResultModelIdentity) =>
      canViewResults ? findLatestResultForModel(model, latestResults) : null,
    [canViewResults, latestResults]
  );

  const getPendingRun = useCallback(
    (model: ViewerResultModelIdentity) =>
      pendingRuns.find(
        run => run.key === viewerModelKey(model) && run.studyInstanceUID === studyInstanceUID
      ) ?? null,
    [pendingRuns, studyInstanceUID]
  );

  const startManagedRun = useCallback(
    async ({
      model,
      studyInstanceUID: runStudyInstanceUID,
      seriesInstanceUIDs,
    }: StartManagedRunRequest): Promise<ManagedRunOutcome> => {
      const modelId = model.modelId?.trim();
      if (!canRunManaged || !modelId) {
        return 'fallback';
      }

      try {
        const run = await repository.runModel({
          studyInstanceUID: runStudyInstanceUID,
          modelId,
          seriesInstanceUIDs,
        });
        const baseline =
          runStudyInstanceUID === studyInstanceUID
            ? findLatestResultForModel(model, latestResultsRef.current)
            : null;
        const pending: PendingViewerModelRun = {
          key: viewerModelKey(model),
          studyInstanceUID: runStudyInstanceUID,
          modelId,
          modelName: run.modelName ?? model.modelName,
          modelVersion: run.modelVersion ?? model.version ?? null,
          runId: run.runId,
          executionId: run.executionId,
          requestedAt: Date.now(),
          baselineCompletedAt: baseline?.completedAt ?? null,
        };
        setPendingRuns(current => [
          ...current.filter(
            item =>
              !(item.key === pending.key && item.studyInstanceUID === pending.studyInstanceUID)
          ),
          pending,
        ]);
        alert(t('ViewerRunQueued', { modelName: pending.modelName }), 'info');
        return 'queued';
      } catch (error: unknown) {
        if (isViewerResultsEndpointMissing(error)) {
          return 'fallback';
        }
        if (
          error instanceof ViewerResultsRequestError &&
          (error.errorCode === VIEWER_RESULTS_ERROR_CODES.runAlreadyActive || error.status === 409)
        ) {
          throw new ViewerResultsRequestError(
            t('ViewerRunAlreadyActive'),
            error.status,
            error.errorCode
          );
        }
        throw new ViewerResultsRequestError(
          t('ViewerRunFailed'),
          error instanceof ViewerResultsRequestError ? error.status : null,
          error instanceof ViewerResultsRequestError ? error.errorCode : null
        );
      }
    },
    [alert, canRunManaged, repository, studyInstanceUID, t]
  );

  const pollPendingRuns = useCallback(async () => {
    const pending = pendingRunsRef.current;
    if (!pending.length) {
      return;
    }

    const studies = [...new Set(pending.map(run => run.studyInstanceUID))];
    const resultsByStudy = new Map<string, ViewerModelResult[]>();
    await Promise.all(
      studies.map(uid =>
        repository.loadLatestResults(uid).then(
          results => {
            resultsByStudy.set(uid, results);
          },
          () => {
            // Transient failures are retried on the next tick.
          }
        )
      )
    );

    const primaryResults = studyInstanceUID ? resultsByStudy.get(studyInstanceUID) : undefined;
    if (primaryResults && canViewResults) {
      refreshGeneration.current += 1;
      setLatestResults(primaryResults);
      setLatestResultsStatus('ready');
    }

    const now = Date.now();
    const completed: ViewerModelResult[] = [];
    const timedOut: PendingViewerModelRun[] = [];
    const stillPending = pending.filter(run => {
      const result = findLatestResultForModel(
        { modelId: run.modelId, modelName: run.modelName, version: run.modelVersion },
        resultsByStudy.get(run.studyInstanceUID) ?? []
      );
      if (result && isResultForPendingRun(result, run)) {
        completed.push(result);
        return false;
      }
      if (now - run.requestedAt > maxPendingMs) {
        timedOut.push(run);
        return false;
      }
      return true;
    });

    if (stillPending.length === pending.length) {
      return;
    }

    setPendingRuns(current =>
      current.filter(run => stillPending.includes(run) || !pending.includes(run))
    );
    if (completed.length) {
      setReadyResults(current => [
        ...current.filter(
          item => !completed.some(result => viewerResultKey(result) === viewerResultKey(item))
        ),
        ...completed,
      ]);
    }
    timedOut.forEach(run =>
      alert(t('ViewerRunStillRunning', { modelName: run.modelName }), 'info')
    );
  }, [alert, canViewResults, maxPendingMs, repository, studyInstanceUID, t]);

  useEffect(() => {
    if (!pendingRuns.length) {
      return;
    }
    const interval = window.setInterval(() => {
      void pollPendingRuns();
    }, pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [pendingRuns.length, pollIntervalMs, pollPendingRuns]);

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

  const setResultMinimized = useCallback(
    (minimized: boolean) =>
      setOpenedResult(current => (current ? { ...current, minimized } : current)),
    []
  );

  const loadSelectedView = useCallback(
    (view: SelectedView): boolean => {
      const { displaySetService, viewportGridService, customizationService } =
        servicesManager.services;
      const [displaySet] = findDisplaySetsForSelectedView(
        view,
        displaySetService.getActiveDisplaySets()
      );
      if (!displaySet) {
        alert(t('ViewerSelectedViewNotLoaded'), 'info');
        return false;
      }

      // Reuse the study browser's double-click behaviour so the clip loads
      // exactly as if the thumbnail had been double-clicked.
      const { activeViewportId, isHangingProtocolLayout } = viewportGridService.getState();
      const customization = customizationService.getCustomization(
        'studyBrowser.thumbnailDoubleClickCallback'
      ) as { callbacks?: Array<(args: unknown) => (uid: string) => Promise<void> | void> };
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

  const value = useMemo<ViewerModelResultsContextValue>(
    () => ({
      canViewResults,
      canRunManaged,
      latestResultsStatus,
      refreshLatestResults,
      getLatestResult,
      getPendingRun,
      startManagedRun,
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
      getPendingRun,
      startManagedRun,
      openResult,
      closeResult,
      setResultMinimized,
      openedResult,
      loadSelectedView,
    ]
  );

  return (
    <ViewerModelResultsContext.Provider value={value}>
      {children}
      {openedResult && !openedResult.minimized && (
        <ViewerModelResultDrawer
          result={openedResult.result}
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
    </ViewerModelResultsContext.Provider>
  );
}

ViewerModelResultsProvider.propTypes = {
  children: PropTypes.node,
  studyInstanceUID: PropTypes.string,
  servicesManager: PropTypes.object.isRequired,
};

export default ViewerModelResultsProvider;
