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
import ViewerModelResultFeedback from './ViewerModelResultFeedback';
import {
  describeResultRun,
  formatRunDateTime,
  isSameResultRun,
  viewerResultKey,
  type ResultRunTrigger,
} from './viewerResultsModel';
import type { ResultSeriesScope, SelectedView, ViewerModelResult } from './types';

export interface ViewerModelResultDrawerProps {
  result: ViewerModelResult;
  // Which series the run used; absent or null when it is not known.
  seriesScope?: ResultSeriesScope | null;
  // The model's completed runs for the study, newest first, `result` among
  // them. With more than one the drawer offers to switch between them.
  runs?: ViewerModelResult[];
  onSelectRun?: (run: ViewerModelResult) => void;
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
  runs = [],
  onSelectRun,
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
    setReport({ status: 'loading' });
    repository
      .loadReport(result)
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
    };
    // The key captures every field the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, resultKey]);

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
          <ul
            role="radiogroup"
            aria-labelledby="viewer-model-result-runs-title"
            className="ohif-scrollbar mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto"
          >
            {runs.map(run => {
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
            {t('ViewerResultLoading', { defaultValue: 'Loading result…' })}
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
                className="mb-4 text-xs text-[#c5cbc5]"
                data-testid="viewer-model-result-report-fallback"
              >
                {t('ViewerReportFallbackNote', {
                  defaultValue: 'The report could not be rendered; showing the stored result.',
                })}
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
