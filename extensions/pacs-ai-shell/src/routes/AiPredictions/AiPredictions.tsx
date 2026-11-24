import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../../components/TopNavigation';
import { isAdminRole } from '../../components/TopNavigation/navigationModel';
import userRepository from '@pacs-ai/extension-core/src/api/userRepository';
import { Permission, can } from '@pacs-ai/extension-core/src/access/permissions';
import { loadUserAccess } from '@pacs-ai/extension-core/src/access/userAccessService';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import { createStudyProcessingRESTRepository } from '@pacs-ai/extension-core/src/studyProcessing/restRepository';
import { createViewerResultsRepository } from '@pacs-ai/extension-inference/src/viewerResults/viewerResultsRepository';
import { ModelExecutionResultDrawer } from '@pacs-ai/extension-inference/src/studyProcessing/ModelExecutionResultDrawer';
import { useModelExecutionResultViewer } from '@pacs-ai/extension-inference/src/studyProcessing/useModelExecutionResultViewer';
import type { ModelExecutionResultClient } from '@pacs-ai/extension-inference/src/studyProcessing/executionResultClient';
import { createStudyRefreshRepository } from '@pacs-ai/extension-inference/src/studyRefresh/studyRefreshRepository';
import { buildProcessingNotificationViewerPath } from '@pacs-ai/extension-inference/src/processingNotificationNavigation';
import { BUTTON_CLASS, ExamRow, type PredictionsActions } from './ExamRow';
import { CompareDialog, RawDataDialog } from './PredictionDialogs';
import { PredictionsFiltersBar, type LaunchedByUser } from './PredictionsFiltersBar';
import {
  availableViews,
  buildPredictionsFilterParams,
  DEFAULT_PREDICTIONS_FILTERS,
  PREDICTIONS_PAGE_SIZE,
  updatePredictionsFilters,
} from './predictionsQuery';
import { createPredictionsRepository, type PredictionsRepository } from './predictionsRepository';
import { createPredictionStudyResolver, type PredictionStudyResolver } from './studyLabels';
import { createExamRetriever, type ExamRetriever } from './examRetrieval';
import { usePredictionsPage } from './usePredictionsPage';
import { useExecutionResults } from './useExecutionResults';
import { enrichPredictionsCSV, parseCSV, serializeCSV } from './csvExport';
import { keyResultModel, summarizeKeyResult } from './keyResults';
import type {
  PredictionExam,
  PredictionExecution,
  PredictionsFilters,
  PredictionsView,
} from './types';

export const PREDICTION_MODALITIES = ['XA', 'US', 'CT', 'MR', 'ECG'];

export interface AiPredictionsDependencies {
  repository?: PredictionsRepository;
  resolver?: PredictionStudyResolver;
  // Retrieves exams whose images were removed from the local store; null
  // disables "Retrieve from PACS and open".
  retriever?: ExamRetriever | null;
  loadCurrentUser?: () => Promise<CurrentPredictionsUser>;
  loadAvailableModels?: () => Promise<{ modelName: string; containerId: string }[]>;
  loadUsers?: () => Promise<LaunchedByUser[]>;
  cancelRun?: (runId: string) => Promise<unknown>;
  runModel?: (studyInstanceUID: string, modelRef: string) => Promise<unknown>;
  saveFile?: (fileName: string, text: string) => void;
  resultClient?: ModelExecutionResultClient;
  now?: () => Date;
}

function defaultSaveFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => window.URL.revokeObjectURL(url), 100);
}

type CurrentPredictionsUser = { id: string; role: string | null; canViewAll?: boolean };

const defaults = {
  loadCurrentUser: async () => {
    const [response, access] = await Promise.all([
      userRepository.GetCurrentUser(),
      loadUserAccess(),
    ]);
    const role = response.data.role ?? null;
    return {
      id: response.data.id,
      role,
      canViewAll: access ? can(access, Permission.RESULTS_VIEW_ALL) : isAdminRole(role),
    };
  },
  loadAvailableModels: async () => {
    const response = await inferenceRepository.GetInferenceAvailableModels();
    return (response.data ?? [])
      .filter(model => model.modelName && model.containerId)
      .map(model => ({ modelName: model.modelName, containerId: model.containerId }));
  },
  loadUsers: async () => {
    const response = await userRepository.GetAllTenantUsers();
    return (response.data ?? [])
      .filter(user => user.id && user.name)
      .map(user => ({ id: user.id, name: user.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  cancelRun: (runId: string) => createStudyProcessingRESTRepository().cancelProcessingRun(runId),
  runModel: (studyInstanceUID: string, modelRef: string) =>
    createViewerResultsRepository().runModel({ studyInstanceUID, modelRef }),
};

type ExportState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done'; truncated: boolean; incomplete: boolean }
  | { status: 'error' };

export function AiPredictionsPage(dependencies: AiPredictionsDependencies = {}) {
  const { t } = useTranslation('AiPredictions');
  const repositoryRef = useRef(dependencies.repository ?? createPredictionsRepository());
  const resolverRef = useRef(dependencies.resolver ?? createPredictionStudyResolver());
  const retrieverRef = useRef<ExamRetriever | null>(
    dependencies.retriever !== undefined
      ? dependencies.retriever
      : createExamRetriever(createStudyRefreshRepository())
  );
  const navigate = useNavigate();
  const nowRef = useRef(dependencies.now ?? (() => new Date()));
  const deps = { ...defaults, ...dependencies };
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const [user, setUser] = useState<CurrentPredictionsUser | null>(null);
  const [userFailed, setUserFailed] = useState(false);
  const [filters, setFilters] = useState<PredictionsFilters>(DEFAULT_PREDICTIONS_FILTERS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runnable, setRunnable] = useState<Map<string, string>>(new Map());
  const [users, setUsers] = useState<LaunchedByUser[]>([]);
  const [raw, setRaw] = useState<PredictionExecution | null>(null);
  const [compare, setCompare] = useState<{
    latest: PredictionExecution;
    earlier: PredictionExecution;
  } | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [now, setNow] = useState(() => nowRef.current().getTime());
  const results = useExecutionResults(t, dependencies.resultClient);
  const resultViewer = useModelExecutionResultViewer(null);

  // results.view_all (always held by OWNER/ADMIN) opens the all-users view.
  const roleCanViewAll = user?.canViewAll ?? isAdminRole(user?.role ?? null);

  useEffect(() => {
    document.title = 'AI Predictions - PACS AI';
  }, []);

  useEffect(() => {
    let cancelled = false;
    depsRef.current
      .loadCurrentUser()
      .then(current => !cancelled && setUser(current))
      .catch(() => !cancelled && setUserFailed(true));
    depsRef.current
      .loadAvailableModels()
      .then(models => {
        if (!cancelled) {
          setRunnable(new Map(models.map(model => [model.modelName, model.containerId])));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roleCanViewAll) {
      return;
    }
    let cancelled = false;
    depsRef.current
      .loadUsers()
      .then(list => !cancelled && setUsers(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [roleCanViewAll]);

  const state = usePredictionsPage({
    filters,
    repository: repositoryRef.current,
    resolver: resolverRef.current,
    enabled: user !== null || userFailed,
    now: nowRef.current,
  });
  const { page, labels } = state;
  // The role decides; the server's answer covers a failed profile lookup.
  const canViewAll = roleCanViewAll || Boolean(page?.canViewAll);

  const hasRunning = Boolean(
    page?.exams.some(exam => exam.models.some(model => model.state === 'running'))
  );
  useEffect(() => {
    if (!hasRunning) {
      return;
    }
    const timer = setInterval(() => setNow(nowRef.current().getTime()), 1000);
    return () => clearInterval(timer);
  }, [hasRunning]);

  const changeFilters = useCallback((change: Partial<PredictionsFilters>) => {
    setFilters(current => updatePredictionsFilters(current, change));
    setExpanded(new Set());
  }, []);

  const views = availableViews(canViewAll);
  const viewLabels: Record<PredictionsView, string> = {
    mine: t('My runs'),
    automatic: t('Automatic runs'),
    all: t('All runs'),
  };

  const modelOptions = useMemo(() => {
    const names = new Set<string>(runnable.keys());
    page?.exams.forEach(exam => exam.models.forEach(model => names.add(model.modelName)));
    if (filters.model) {
      names.add(filters.model);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [runnable, page, filters.model]);

  const actions: PredictionsActions = useMemo(
    () => ({
      results,
      openResult: (studyInstanceUID, execution, trigger) =>
        resultViewer.open(
          {
            studyInstanceUID,
            runId: execution.runId,
            executionId: execution.executionId,
            modelName: execution.modelName,
            modelVersion: execution.modelVersion,
            status: 'completed',
          },
          trigger
        ),
      openRaw: execution => setRaw(execution),
      openCompare: (latest, earlier) => setCompare({ latest, earlier }),
      cancel: async execution => {
        await depsRef.current.cancelRun(execution.runId);
        state.reload();
      },
      runAgain: async (exam: PredictionExam, execution) => {
        const modelRef = runnable.get(execution.modelName);
        if (!modelRef) {
          throw new Error('The model is not available.');
        }
        await depsRef.current.runModel(exam.studyInstanceUID, modelRef);
        state.reload();
      },
      canRunAgain: modelName => runnable.has(modelName),
      loadHistory: (studyInstanceUID, modelName) =>
        repositoryRef.current
          .loadModelHistory(studyInstanceUID, modelName)
          .then(history => history.executions),
      retriever: retrieverRef.current,
      openExam: studyInstanceUID =>
        navigate(buildProcessingNotificationViewerPath(studyInstanceUID)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, resultViewer.open, runnable, state.reload, navigate]
  );

  const exportCSV = async () => {
    setExportState({ status: 'working' });
    try {
      const exported = await repositoryRef.current.exportCSV(
        buildPredictionsFilterParams(filters, nowRef.current())
      );
      const rows = parseCSV(exported.text);
      const summary = await enrichPredictionsCSV(rows, {
        patientName: async uid => {
          const metadata = await resolverRef.current.resolve(uid);
          return metadata?.patientName ? metadata.patientName.replace(/\^+/g, ' ').trim() : null;
        },
        hasKeyResult: modelName => keyResultModel(modelName) !== null,
        keyResult: async ({ runId, executionId, modelName }) =>
          summarizeKeyResult(modelName, await results.loadResult({ runId, executionId }), t),
      });
      (depsRef.current.saveFile ?? defaultSaveFile)(exported.fileName, serializeCSV(rows));
      setExportState({
        status: 'done',
        truncated: exported.truncated,
        incomplete: summary.namesSkipped > 0 || summary.resultsSkipped > 0,
      });
    } catch (error: unknown) {
      setExportState({ status: 'error' });
    }
  };

  const exams = page ? [...page.exams, ...state.nameMatches] : [];
  const firstShown = page && page.total > 0 ? page.offset + 1 : 0;
  const lastShown = page ? page.offset + page.exams.length : 0;

  return (
    <div className="flex h-screen w-screen flex-col overflow-x-hidden bg-[#101410] text-[#E8ECE6]">
      <TopNavigation title={t('AI Predictions')} />
      <main className="ohif-scrollbar mx-auto min-h-0 w-full max-w-[1380px] grow overflow-y-auto px-4 pb-8 pt-6 sm:px-7">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <h1 className="m-0 text-2xl font-bold">{t('AI Predictions')}</h1>
          <div
            role="group"
            aria-label={t('Whose runs')}
            className="flex overflow-hidden rounded-lg border border-[#3A4438] text-[13px]"
          >
            {views.map((view, index) => (
              <button
                key={view}
                type="button"
                aria-pressed={filters.view === view}
                className={`min-h-[44px] px-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#C8F469] ${
                  index > 0 ? 'border-l border-[#3A4438]' : ''
                } ${filters.view === view ? 'bg-[#C8F469] font-semibold text-[#141a10]' : 'text-[#E8ECE6] hover:bg-white/5'}`}
                onClick={() => changeFilters({ view })}
              >
                {viewLabels[view]}
                {view === 'all' && (
                  <span className="ml-1.5 rounded-lg border border-current px-2 py-0.5 text-[11px]">
                    {t('Admin')}
                  </span>
                )}
              </button>
            ))}
          </div>
          {canViewAll && (
            <p className="flex-[1_1_260px] text-xs text-[#A9B3A6]">
              {t('All runs is shown to workspace administrators only')}
            </p>
          )}
          <button
            type="button"
            className={`${BUTTON_CLASS} ml-auto`}
            onClick={exportCSV}
            disabled={exportState.status === 'working' || state.invalidDateRange}
            aria-describedby="ai-predictions-export-status"
          >
            {exportState.status === 'working'
              ? t('Preparing the export…')
              : t('Export CSV (one line per model run)')}
          </button>
        </div>
        <p
          id="ai-predictions-export-status"
          className="mb-2 text-xs text-[#C9D1C6]"
          role={exportState.status === 'error' ? 'alert' : 'status'}
        >
          {exportState.status === 'error' && t('The export failed. Try again.')}
          {exportState.status === 'done' &&
            [
              t('Export saved.'),
              exportState.truncated ? t('Only the 5000 most recent exams were exported.') : null,
              exportState.incomplete
                ? t(
                    'Some patient names or key results were left empty to limit the load on the PACS.'
                  )
                : null,
            ]
              .filter(Boolean)
              .join(' ')}
        </p>

        <PredictionsFiltersBar
          filters={filters}
          models={modelOptions}
          modalities={PREDICTION_MODALITIES}
          users={users}
          onChange={changeFilters}
          invalidDateRange={state.invalidDateRange}
        />

        {state.status === 'error' && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-[#7A4A3C] bg-[#40231C] px-4 py-3 text-[13px] text-[#FFB199]"
          >
            {state.error?.status === 403
              ? t('Only workspace administrators can see every run.')
              : t('AI predictions could not be loaded.')}{' '}
            <button
              type="button"
              className="ml-2 min-h-[44px] underline"
              onClick={state.reload}
            >
              {t('Try again')}
            </button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-[#222922] bg-[#171d17]">
          <table
            className="w-full border-collapse"
            aria-busy={state.status === 'loading'}
            aria-describedby="ai-predictions-summary"
          >
            <thead>
              <tr className="text-left text-xs font-semibold text-[#A9B3A6]">
                <th
                  scope="col"
                  className="w-[68px] border-b border-[#2B332A] px-3 py-2.5"
                >
                  <span className="sr-only">{t('Expand')}</span>
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap border-b border-[#2B332A] px-3 py-2.5"
                >
                  {t('Last activity')}
                </th>
                <th
                  scope="col"
                  className="border-b border-[#2B332A] px-3 py-2.5"
                >
                  {t('Patient / exam')}
                </th>
                <th
                  scope="col"
                  className="border-b border-[#2B332A] px-3 py-2.5"
                >
                  {t('Models')}
                </th>
                <th
                  scope="col"
                  className="border-b border-[#2B332A] px-3 py-2.5"
                >
                  {t('Launched by')}
                </th>
                <th
                  scope="col"
                  className="border-b border-[#2B332A] px-3 py-2.5"
                >
                  {t('Open')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(state.status === 'loading' || state.status === 'idle') && !exams.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[13px] text-[#A9B3A6]"
                    role="status"
                  >
                    {t('Loading AI predictions…')}
                  </td>
                </tr>
              )}
              {state.status === 'ready' && !exams.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-[13px] text-[#C9D1C6]"
                    data-testid="ai-predictions-empty"
                  >
                    {filters.view === 'mine'
                      ? t('No exam with a run you launched matches these filters.')
                      : t('No exam matches these filters.')}
                  </td>
                </tr>
              )}
              {state.status !== 'error' &&
                exams.map(exam => (
                  <ExamRow
                    key={exam.studyInstanceUID}
                    exam={exam}
                    labels={labels[exam.studyInstanceUID]}
                    expanded={expanded.has(exam.studyInstanceUID)}
                    onToggle={() =>
                      setExpanded(current => {
                        const next = new Set(current);
                        if (!next.delete(exam.studyInstanceUID)) {
                          next.add(exam.studyInstanceUID);
                        }
                        return next;
                      })
                    }
                    actions={actions}
                    now={now}
                  />
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#A9B3A6]">
          <p
            id="ai-predictions-summary"
            role="status"
          >
            {page
              ? t('Showing {{first}}–{{last}} of {{total}} exams', {
                  first: firstShown,
                  last: lastShown,
                  total: page.total,
                })
              : ''}
            {state.nameMatches.length > 0 &&
              ` ${t('+ {{count}} loaded earlier whose patient name matches', { count: state.nameMatches.length })}`}
          </p>
          <nav
            aria-label={t('Pages')}
            className="flex gap-2"
          >
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={!page || filters.page === 0}
              onClick={() => changeFilters({ page: filters.page - 1 })}
            >
              {t('Previous')}
            </button>
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={!page?.hasMore}
              onClick={() => changeFilters({ page: filters.page + 1 })}
            >
              {t('Next')}
            </button>
          </nav>
        </div>
        <p className="mt-2 text-[11px] text-[#A9B3A6]">
          {t('{{count}} exams per page. Exams with running models refresh automatically.', {
            count: PREDICTIONS_PAGE_SIZE,
          })}
        </p>
      </main>

      <ModelExecutionResultDrawer
        state={resultViewer.state}
        onClose={resultViewer.close}
        onRetry={resultViewer.retry}
      />
      {raw && (
        <RawDataDialog
          execution={raw}
          loadResult={() => results.loadResult(raw)}
          onClose={() => setRaw(null)}
        />
      )}
      {compare && (
        <CompareDialog
          latest={compare.latest}
          earlier={compare.earlier}
          loadResult={results.loadResult}
          onClose={() => setCompare(null)}
        />
      )}
    </div>
  );
}

export default function AiPredictions() {
  return <AiPredictionsPage />;
}
