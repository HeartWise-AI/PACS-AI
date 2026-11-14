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
import { viewerResultKey } from './viewerResultsModel';
import type { SelectedView, ViewerModelResult } from './types';

export interface ViewerModelResultDrawerProps {
  result: ViewerModelResult;
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

function canLoadReport(result: ViewerModelResult): boolean {
  return (
    result.reportAvailable && (!!(result.runId && result.executionId) || !!result.studyServiceJobId)
  );
}

export function ViewerModelResultDrawer({
  result,
  repository,
  onClose,
  onMinimize,
  onSelectView,
}: ViewerModelResultDrawerProps) {
  const { t } = useTranslation('AIModelButton');
  const resultKey = viewerResultKey(result);
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

  const trigger = result.trigger ? TRIGGER_LABELS[result.trigger] : undefined;
  const selectedViews = useMemo(() => result.selectedViews, [result.selectedViews]);
  const structuredState = structured.state;
  const failurePresentation = getModelExecutionResultFailurePresentation(structuredState.failure);

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
            {result.trigger &&
              ` · ${trigger ? t(trigger.key, { defaultValue: trigger.defaultValue }) : result.trigger}`}
          </p>
        </div>
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
