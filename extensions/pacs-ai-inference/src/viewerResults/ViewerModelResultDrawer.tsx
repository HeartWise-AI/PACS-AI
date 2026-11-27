import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { decodeBase64HTML, HTML_REPORT_IFRAME_SANDBOX } from '../htmlReport';
import { ModelResultRenderer } from '../studyProcessing/modelResults/ModelResultRenderer';
import { useModelExecutionResultViewer } from '../studyProcessing/useModelExecutionResultViewer';
import {
  getModelExecutionResultFailurePresentation,
  isEmptyModelExecutionResult,
} from '../studyProcessing/modelExecutionResultPresentation';
import type { ViewerResultsRepository } from './viewerResultsRepository';
import { loadReportWithRetry } from './reportRetry';
import ViewerModelResultFeedback from './ViewerModelResultFeedback';
import ViewerRunLabels from './ViewerRunLabels';
import {
  bestRunWithLabel,
  collectRunLabels,
  describeResultRun,
  formatRunDateTime,
  isSameResultRun,
  runHasLabel,
  sameRunLabel,
  viewerResultKey,
  type ResultRunTrigger,
} from './viewerResultsModel';
import type { ResultInput, ResultSeriesScope, SelectedView, ViewerModelResult } from './types';

export interface ViewerModelResultDrawerProps {
  result: ViewerModelResult;
  // Which series the run used; absent or null when it is not known.
  seriesScope?: ResultSeriesScope | null;
  // The series, study date and acquisition time the result was computed
  // from, shown first; null when the viewer cannot describe it.
  input?: ResultInput | null;
  // The model's completed runs for the study, newest first, `result` among
  // them. With more than one the drawer offers to switch between them.
  runs?: ViewerModelResult[];
  onSelectRun?: (run: ViewerModelResult) => void;
  // Whether the user may add and remove run labels (models.use); the backend
  // also checks access to the run's model.
  canEditLabels?: boolean;
  // Called with a run's labels after the user changed them.
  onRunLabelsChanged?: (run: ViewerModelResult, labels: string[]) => void;
  repository: ViewerResultsRepository;
  onClose: () => void;
  onMinimize: () => void;
  onSelectView: (view: SelectedView) => boolean;
}

type ReportState =
  | { status: 'loading' }
  | { status: 'ready'; html: string }
  | { status: 'error' }
  | { status: 'none' };

const TRIGGER_LABELS: Record<string, { key: string; defaultValue: string }> = {
  AUTO: { key: 'ViewerResultTriggerAuto', defaultValue: 'Automatic' },
  MANUAL_REPROCESS: { key: 'ViewerResultTriggerManual', defaultValue: 'Manual reprocess' },
  VIEWER_REQUEST: { key: 'ViewerResultTriggerViewer', defaultValue: 'Run from viewer' },
  LEGACY_IMPORT: { key: 'ViewerResultTriggerLegacy', defaultValue: 'Imported' },
};

const LEGACY_TRIGGER_LABEL = {
  key: 'ViewerResultTriggerAutoLegacy',
  defaultValue: 'Automatic (legacy)',
};

const RUN_TRIGGER_LABELS: Record<ResultRunTrigger, { key: string; defaultValue: string }> = {
  auto: { key: 'ViewerRunTriggerAuto', defaultValue: 'Auto' },
  viewer: { key: 'ViewerRunTriggerViewer', defaultValue: 'Viewer rerun' },
  manual: { key: 'ViewerRunTriggerManual', defaultValue: 'Reprocess' },
  imported: { key: 'ViewerRunTriggerImported', defaultValue: 'Imported' },
  legacy: { key: 'ViewerRunTriggerLegacy', defaultValue: 'Auto (legacy)' },
};

function canLoadReport(result: ViewerModelResult): boolean {
  return (
    result.reportAvailable && (!!(result.runId && result.executionId) || !!result.studyServiceJobId)
  );
}

export function ViewerModelResultDrawer({
  result,
  seriesScope = null,
  input = null,
  runs = [],
  onSelectRun,
  canEditLabels = false,
  onRunLabelsChanged,
  repository,
  onClose,
  onMinimize,
  onSelectView,
}: ViewerModelResultDrawerProps) {
  const { t } = useTranslation('AIModelButton');
  // The run and execution identify what is shown: a result first opened from
  // its run ids and then replaced by the listed one is not loaded twice.
  const resultKey =
    result.runId && result.executionId
      ? JSON.stringify([result.studyInstanceUID, result.runId, result.executionId])
      : viewerResultKey(result);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [report, setReport] = useState<ReportState>(() =>
    canLoadReport(result) ? { status: 'loading' } : { status: 'none' }
  );
  // Incremented by the Retry button to request the report again.
  const [reportAttempt, setReportAttempt] = useState(0);
  const structured = useModelExecutionResultViewer(resultKey);
  const hasExecution = !!(result.runId && result.executionId);
  const showStructured = report.status === 'none' || (report.status === 'error' && hasExecution);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [resultKey]);

  useEffect(() => {
    if (!canLoadReport(result)) {
      setReport({ status: 'none' });
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setReport({ status: 'loading' });
    // Network errors and 5xx are retried (1 s, 2 s, 4 s) before the drawer
    // falls back to the stored result.
    loadReportWithRetry(() => repository.loadReport(result), {
      wait: ms =>
        new Promise<void>(resolve => {
          retryTimer = setTimeout(resolve, ms);
        }),
      isCancelled: () => cancelled,
    })
      .then(loaded => {
        if (!cancelled) {
          setReport({ status: 'ready', html: decodeBase64HTML(loaded.htmlBase64) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReport({ status: 'error' });
        }
      });
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
      }
    };
    // The key captures every field the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, resultKey, reportAttempt]);

  const retryReport = () => setReportAttempt(attempt => attempt + 1);

  const { open: openStructured } = structured;
  useEffect(() => {
    if (showStructured && result.runId && result.executionId) {
      openStructured({
        studyInstanceUID: result.studyInstanceUID,
        runId: result.runId,
        executionId: result.executionId,
        modelName: result.modelName,
        modelVersion: result.modelVersion,
        status: 'completed',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStructured, resultKey, openStructured]);

  // A null trigger means study-service ran the model without an api-pacs run.
  const trigger = result.trigger ? TRIGGER_LABELS[result.trigger] : LEGACY_TRIGGER_LABEL;
  const selectedViews = useMemo(() => result.selectedViews, [result.selectedViews]);
  const structuredState = structured.state;
  const seriesScopeLabel =
    seriesScope?.kind === 'subset'
      ? t('ViewerResultSeriesSubset', {
          used: seriesScope.used,
          total: seriesScope.total,
          defaultValue: `${seriesScope.used} of ${seriesScope.total} series`,
        })
      : seriesScope?.kind === 'count'
        ? t('ViewerResultSeriesCount', {
            used: seriesScope.used,
            defaultValue: `${seriesScope.used} series`,
          })
        : t('ViewerResultSeriesAll', { defaultValue: 'All series' });
  // Only series the viewer can describe are worth listing.
  const describedSeries = (seriesScope?.series ?? []).filter(
    series => series.seriesNumber || series.description
  );
  const failurePresentation = getModelExecutionResultFailurePresentation(structuredState.failure);

  // Run labels: filtering the run list by a label also shows that label's
  // default run (best-run rule among the labelled runs).
  const runLabels = useMemo(() => collectRunLabels(runs), [runs]);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const activeLabelFilter =
    labelFilter && runLabels.some(label => sameRunLabel(label, labelFilter)) ? labelFilter : null;
  const visibleRuns = activeLabelFilter
    ? runs.filter(run => runHasLabel(run, activeLabelFilter))
    : runs;
  const selectLabel = (label: string | null) => {
    setLabelFilter(label);
    // The label's default run, whichever run is shown now.
    const best = label ? bestRunWithLabel(runs, label) : null;
    if (best && !isSameResultRun(best, result)) {
      onSelectRun?.(best);
    }
  };

  const runLabel = (run: ViewerModelResult) => {
    const description = describeResultRun(run, runs);
    const trigger = RUN_TRIGGER_LABELS[description.trigger];
    const series =
      description.series === 'all'
        ? t('ViewerResultSeriesAll', { defaultValue: 'All series' })
        : description.series !== null
          ? t('ViewerResultSeriesCount', {
              used: description.series,
              defaultValue: `${description.series} series`,
            })
          : null;
    const videos =
      description.eligibleVideoCount === null
        ? null
        : description.inputVideoCount !== null &&
            description.inputVideoCount !== description.eligibleVideoCount
          ? t('ViewerRunVideosOf', {
              used: description.eligibleVideoCount,
              total: description.inputVideoCount,
              defaultValue: `Videos used: ${description.eligibleVideoCount} of ${description.inputVideoCount}`,
            })
          : t('ViewerRunVideos', {
              used: description.eligibleVideoCount,
              defaultValue: `Videos used: ${description.eligibleVideoCount}`,
            });
    return {
      best: description.best,
      text: [
        formatRunDateTime(description.completedTime),
        t(trigger.key, { defaultValue: trigger.defaultValue }),
        series,
        videos,
        description.version ? `v${description.version}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  };

  // "Input: Series 5 – FL - CTO · Study 2023-01-23 · Acquired 2023-01-23 10:20"
  const inputText = (() => {
    if (!input) {
      return null;
    }
    const numbers = input.series.map(series => series.seriesNumber).filter(Boolean) as string[];
    let seriesText: string;
    if (input.source === 'all') {
      seriesText = t('ViewerResultInputAllSeries', {
        count: input.seriesCount,
        modality: input.modality ?? '',
        defaultValue: `All ${input.modality ?? ''} series (${input.seriesCount})`,
      }).replace(/\s+/g, ' ');
    } else if (input.seriesCount === 1 && input.series.length === 1) {
      const [only] = input.series;
      seriesText = [
        only.seriesNumber
          ? t('ViewerResultInputSeriesOne', {
              number: only.seriesNumber,
              defaultValue: `Series ${only.seriesNumber}`,
            })
          : null,
        only.description,
      ]
        .filter(Boolean)
        .join(' – ');
    } else if (numbers.length && numbers.length === input.seriesCount) {
      const shown =
        numbers.length > 8 ? `${numbers.slice(0, 8).join(', ')}, …` : numbers.join(', ');
      seriesText = t('ViewerResultInputSeriesMany', {
        count: input.seriesCount,
        numbers: shown,
        defaultValue: `${input.seriesCount} series: ${shown}`,
      });
    } else {
      seriesText = t('ViewerResultInputSeriesCount', {
        count: input.seriesCount,
        defaultValue: `${input.seriesCount} series`,
      });
    }
    const { acquiredFrom: from, acquiredTo: to, studyDate } = input;
    const acquired = !from
      ? null
      : from === to || !to
        ? from
        : from.slice(0, 10) === to.slice(0, 10)
          ? `${from.slice(0, 10) === studyDate ? '' : `${from.slice(0, 10)} `}${from.slice(11)}–${to.slice(11)}`
          : `${from} – ${to}`;
    return [
      seriesText || null,
      studyDate
        ? t('ViewerResultInputStudyDate', { date: studyDate, defaultValue: `Study ${studyDate}` })
        : null,
      acquired
        ? t('ViewerResultInputAcquired', { time: acquired, defaultValue: `Acquired ${acquired}` })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
  })();

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="viewer-model-result-title"
      className="border-white/15 fixed top-0 right-0 z-[9999] flex h-full w-full max-w-3xl flex-col border-l bg-[#151815] text-white shadow-2xl"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      data-testid="viewer-model-result-drawer"
    >
      <header className="flex items-start gap-4 border-b border-white/10 px-5 py-4">
        <div className="min-w-0 grow">
          <h2
            id="viewer-model-result-title"
            className="text-lg font-bold"
          >
            {result.modelName}
            {result.modelVersion && (
              <span className="ml-2 text-sm font-normal text-[#c5cbc5]">
                v{result.modelVersion}
              </span>
            )}
          </h2>
          {inputText && (
            <p
              className="mt-1 text-sm text-white"
              data-testid="viewer-model-result-input"
            >
              <span className="font-semibold text-[#3ef1d1]">
                {t('ViewerResultInputLabel', { defaultValue: 'Input' })}:
              </span>{' '}
              {inputText}
            </p>
          )}
          <p className="mt-1 text-sm text-[#c5cbc5]">
            {result.completedAt && new Date(result.completedAt).toLocaleString()}
            {` · ${trigger ? t(trigger.key, { defaultValue: trigger.defaultValue }) : result.trigger}`}
            {seriesScope && (
              <>
                {' · '}
                <span
                  className="group relative inline-block focus:outline-none"
                  tabIndex={describedSeries.length ? 0 : undefined}
                  aria-describedby={
                    describedSeries.length ? 'viewer-model-result-series-list' : undefined
                  }
                  data-testid="viewer-model-result-series-scope"
                  data-series-scope={seriesScope.kind}
                >
                  <span
                    className={
                      seriesScope.kind === 'subset'
                        ? 'rounded border border-[#3ef1d1]/60 px-1.5 py-0.5 text-xs font-semibold text-[#3ef1d1] group-focus:border-[#3ef1d1]'
                        : 'group-focus:underline'
                    }
                  >
                    {seriesScopeLabel}
                  </span>
                  {describedSeries.length > 0 && (
                    <span
                      id="viewer-model-result-series-list"
                      role="tooltip"
                      className="ohif-scrollbar border-white/15 absolute left-0 top-full z-10 mt-1 hidden max-h-64 w-max max-w-xs overflow-y-auto rounded-md border bg-[#232823] px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus:block"
                      data-testid="viewer-model-result-series-list"
                    >
                      <span className="mb-1 block font-semibold">
                        {t('ViewerResultSeriesListTitle', {
                          defaultValue: 'Series used by this run',
                        })}
                      </span>
                      {describedSeries.map(series => (
                        <span
                          key={series.seriesInstanceUID}
                          className="block truncate"
                        >
                          {[series.seriesNumber, series.description].filter(Boolean).join(' · ')}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </>
            )}
          </p>
          {result.labels !== undefined && (
            <ViewerRunLabels
              run={result}
              repository={repository}
              canEdit={canEditLabels}
              onLabelsChanged={onRunLabelsChanged}
            />
          )}
        </div>
        <ViewerModelResultFeedback result={result} />
        <button
          type="button"
          className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          onClick={onMinimize}
          data-testid="viewer-model-result-minimize"
        >
          {t('ViewerResultHide', { defaultValue: 'Hide' })}
        </button>
        <button
          ref={closeButtonRef}
          type="button"
          className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          onClick={onClose}
          data-testid="viewer-model-result-close"
        >
          {t('ViewerResultClose', { defaultValue: 'Close' })}
        </button>
      </header>

      {runs.length > 1 && (
        <section
          className="border-b border-white/10 px-5 py-3"
          data-testid="viewer-model-result-runs"
        >
          <h3
            id="viewer-model-result-runs-title"
            className="text-sm font-semibold"
          >
            {t('ViewerRunsTitle', {
              count: runs.length,
              defaultValue: `Runs of this model (${runs.length})`,
            })}
          </h3>
          {runLabels.length > 0 && (
            <div
              role="group"
              aria-label={t('ViewerRunLabelFilter', { defaultValue: 'Show runs with label' })}
              className="mt-2 flex flex-wrap items-center gap-1.5 text-xs"
              data-testid="viewer-run-label-filter"
            >
              <span className="text-[#c5cbc5]">
                {t('ViewerRunLabelFilter', { defaultValue: 'Show runs with label' })}
              </span>
              {[null, ...runLabels].map(label => {
                const active =
                  label === null
                    ? activeLabelFilter === null
                    : !!activeLabelFilter && sameRunLabel(label, activeLabelFilter);
                return (
                  <button
                    key={label ?? ''}
                    type="button"
                    aria-pressed={active}
                    className={`rounded-full border px-2 py-0.5 font-semibold ${
                      active
                        ? 'border-[#3ef1d1] bg-[#3ef1d1]/20 text-white'
                        : 'border-white/20 text-[#c5cbc5] hover:bg-white/10'
                    }`}
                    onClick={() => selectLabel(label)}
                    data-testid="viewer-run-label-filter-option"
                    data-label={label ?? ''}
                  >
                    {label ?? t('ViewerRunLabelFilterAll', { defaultValue: 'All' })}
                  </button>
                );
              })}
            </div>
          )}
          <ul
            role="radiogroup"
            aria-labelledby="viewer-model-result-runs-title"
            className="ohif-scrollbar mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto"
          >
            {visibleRuns.map(run => {
              const label = runLabel(run);
              const selected = isSameResultRun(run, result);
              return (
                <li key={viewerResultKey(run)}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs ${
                      selected
                        ? 'border-[#3ef1d1] bg-[#3ef1d1]/10 text-white'
                        : 'border-white/15 text-[#c5cbc5] hover:bg-white/10'
                    }`}
                    onClick={() => {
                      if (!selected) {
                        onSelectRun?.(run);
                      }
                    }}
                    data-testid="viewer-model-result-run"
                    data-run-selected={selected}
                    data-run-best={label.best}
                    data-run-trigger={run.trigger ?? ''}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        selected ? 'bg-[#3ef1d1]' : 'border border-white/40'
                      }`}
                    />
                    <span className="min-w-0 grow truncate">{label.text}</span>
                    {(run.labels ?? []).map(runLabelText => (
                      <span
                        key={runLabelText}
                        className="shrink-0 rounded-full border border-white/25 px-1.5 py-0.5 text-[11px] text-white/80"
                        data-testid="viewer-model-result-run-label"
                      >
                        {runLabelText}
                      </span>
                    ))}
                    {label.best && (
                      <span
                        className="shrink-0 rounded border border-[#3ef1d1]/60 px-1.5 py-0.5 font-semibold text-[#3ef1d1]"
                        title={t('ViewerRunBestHint', {
                          defaultValue:
                            'Shown by default: the run that used the most eligible videos (the newest on a tie).',
                        })}
                        data-testid="viewer-model-result-run-best"
                      >
                        {t('ViewerRunBest', { defaultValue: 'Best run' })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section
        className="border-b border-white/10 px-5 py-3"
        data-testid="viewer-model-result-selected-views"
      >
        {selectedViews === null ? (
          <p className="text-sm text-[#c5cbc5]">
            {t('ViewerViewsNotRecorded', { defaultValue: 'Views not recorded for this run' })}
          </p>
        ) : (
          <>
            <h3 className="text-sm font-semibold">
              {t('ViewerSelectedViews', {
                count: selectedViews.length,
                defaultValue: `Selected views (${selectedViews.length})`,
              })}
            </h3>
            <ol className="mt-2 flex flex-wrap gap-2">
              {selectedViews.map((view, index) => (
                <li key={`${view.sopInstanceUID ?? view.seriesInstanceUID}-${index}`}>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                    onClick={() => onSelectView(view)}
                    title={t('ViewerSelectedViewLoad', {
                      defaultValue: 'Load this clip in the active viewport',
                    })}
                    data-testid="viewer-model-result-selected-view"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3ef1d1] font-bold text-black">
                      {index + 1}
                    </span>
                    <span>
                      {view.viewLabel ?? t('ViewerUnknownView', { defaultValue: 'Unknown view' })}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <div className="ohif-scrollbar min-h-0 grow overflow-y-auto">
        {(report.status === 'loading' ||
          (showStructured && structuredState.status === 'loading')) && (
          <p
            role="status"
            className="px-5 py-5 text-sm text-[#c5cbc5]"
            data-testid="viewer-model-result-loading"
          >
            {report.status === 'loading'
              ? t('ViewerReportLoading', { defaultValue: 'Loading report…' })
              : t('ViewerResultLoading', { defaultValue: 'Loading result…' })}
          </p>
        )}
        {report.status === 'ready' && (
          <iframe
            srcDoc={report.html}
            className="h-full w-full bg-white"
            title={result.modelName}
            sandbox={HTML_REPORT_IFRAME_SANDBOX}
            data-testid="viewer-model-result-report"
          />
        )}
        {report.status === 'error' && !hasExecution && (
          <p
            role="alert"
            className="px-5 py-5 text-sm text-[#ffb0b0]"
          >
            {t('ViewerReportUnavailable', { defaultValue: 'The report could not be loaded.' })}
            <button
              type="button"
              className="ml-3 rounded-md border border-current px-3 py-1 text-xs font-bold hover:bg-white/10"
              onClick={retryReport}
              data-testid="viewer-model-result-report-retry"
            >
              {t('ViewerReportRetry', { defaultValue: 'Retry' })}
            </button>
          </p>
        )}
        {showStructured && !hasExecution && report.status === 'none' && (
          <p
            className="px-5 py-5 text-sm text-[#c5cbc5]"
            data-testid="viewer-model-result-no-details"
          >
            {t('ViewerResultDetailsUnavailable', {
              defaultValue: 'Result details are not available for this run.',
            })}
          </p>
        )}
        {showStructured && hasExecution && (
          <div className="px-5 py-5">
            {report.status === 'error' && (
              <p
                className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[#c5cbc5]"
                data-testid="viewer-model-result-report-fallback"
              >
                <span>
                  {t('ViewerReportFallbackNote', {
                    defaultValue: 'The report could not be rendered; showing the stored result.',
                  })}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-current px-3 py-1 font-bold hover:bg-white/10"
                  onClick={retryReport}
                  data-testid="viewer-model-result-report-retry"
                >
                  {t('ViewerReportRetry', { defaultValue: 'Retry' })}
                </button>
              </p>
            )}
            {structuredState.status === 'ready' &&
              structuredState.result &&
              !isEmptyModelExecutionResult(structuredState.result.result) && (
                <ModelResultRenderer result={structuredState.result} />
              )}
            {structuredState.status === 'error' && (
              <div
                role="alert"
                className="text-sm text-[#ffb0b0]"
              >
                <p>
                  {t(`StudyList:${failurePresentation.key}`, {
                    defaultValue: failurePresentation.defaultValue,
                  })}
                </p>
                {structuredState.failure?.retryable && (
                  <button
                    type="button"
                    className="mt-3 rounded-md border border-current px-3 py-1 text-xs font-bold hover:bg-white/10"
                    onClick={structured.retry}
                  >
                    {t('ViewerResultRetry', { defaultValue: 'Try again' })}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default ViewerModelResultDrawer;
