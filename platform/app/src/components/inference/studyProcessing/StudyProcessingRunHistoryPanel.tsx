import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KnownProcessingAttentionReasonCode, ModelExecution, ProcessingRun } from './types';
import { useStudyProcessing } from './StudyProcessingProvider';
import type { StudyProcessingRunHistoryTransport } from './runHistoryTransport';
import {
  createRunHistorySynchronizationCoordinator,
  getRunHistorySynchronizationTarget,
} from './runHistorySynchronization';
import { StudyReprocessAction } from './StudyReprocessAction';
import type { ModelExecutionResultSelection } from './executionResultQuery';
import { createModelExecutionResultSelection } from './executionResultSelection';

const executionToneClassNames: Record<ModelExecution['status'], string> = {
  pending: 'text-[#c3c9c3]',
  queued: 'text-[#c3c9c3]',
  running: 'text-[#60a5fa]',
  completed: 'text-[#4ade80]',
  failed: 'text-[#f87171]',
  skipped: 'text-[#facc15]',
  cancelled: 'text-[#b2bac2]',
};

const attentionReasonPresentations: Record<
  KnownProcessingAttentionReasonCode,
  { key: string; label: string }
> = {
  DISPATCH_FAILED: {
    key: 'ProcessingAttentionReason.DISPATCH_FAILED',
    label: 'Model dispatch failed',
  },
  EXPECTED_JOB_MISSING: {
    key: 'ProcessingAttentionReason.EXPECTED_JOB_MISSING',
    label: 'An expected model job is missing',
  },
  PENDING_STALE: {
    key: 'ProcessingAttentionReason.PENDING_STALE',
    label: 'A model has remained pending too long',
  },
  QUEUE_STALE: {
    key: 'ProcessingAttentionReason.QUEUE_STALE',
    label: 'A model has remained queued too long',
  },
  PROCESSING_STALE: {
    key: 'ProcessingAttentionReason.PROCESSING_STALE',
    label: 'Model processing appears stalled',
  },
  CALLBACK_DEAD_LETTERED: {
    key: 'ProcessingAttentionReason.CALLBACK_DEAD_LETTERED',
    label: 'A model callback could not be delivered',
  },
  STUDY_SERVICE_JOB_MISSING: {
    key: 'ProcessingAttentionReason.STUDY_SERVICE_JOB_MISSING',
    label: 'The study-service job is missing',
  },
  STATE_CONFLICT: {
    key: 'ProcessingAttentionReason.STATE_CONFLICT',
    label: 'Conflicting processing states were detected',
  },
  RECONCILIATION_FAILED: {
    key: 'ProcessingAttentionReason.RECONCILIATION_FAILED',
    label: 'Processing state reconciliation failed',
  },
  EMPTY_MODEL_PLAN: {
    key: 'ProcessingAttentionReason.EMPTY_MODEL_PLAN',
    label: 'No models were selected for this study',
  },
};

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDateTime(timestamp: string | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '—';
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) {
    return '—';
  }

  const durationSeconds = Math.max(
    0,
    Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000)
  );
  if (durationSeconds < 60) {
    return `${durationSeconds} s`;
  }

  const minutes = Math.floor(durationSeconds / 60);
  return `${minutes} m ${durationSeconds % 60} s`;
}

function runLabel(run: ProcessingRun): { key: string; label: string } {
  if (run.trigger === 'LEGACY_IMPORT') {
    return { key: 'ProcessingRunLegacy', label: 'Legacy import' };
  }
  if (run.phase !== 'TERMINAL') {
    return { key: 'ProcessingRunActive', label: 'Active' };
  }
  if (run.outcome === 'PARTIAL_SUCCESS' || run.outcome === 'SUCCESS_WITH_SKIPS') {
    return { key: 'ProcessingRunPartial', label: 'Partial' };
  }
  if (run.outcome === 'FAILED') {
    return { key: 'ProcessingStatusFailed', label: 'Failed' };
  }
  if (run.outcome === 'CANCELLED') {
    return { key: 'ProcessingStatusCancelled', label: 'Cancelled' };
  }
  return { key: 'ProcessingRunCompleted', label: 'Completed' };
}

function runToneClassName(run: ProcessingRun): string {
  if (run.trigger === 'LEGACY_IMPORT' || run.outcome === 'CANCELLED') {
    return 'border-[#65717c] bg-[#343b40] text-[#c3cbd3]';
  }
  if (run.phase !== 'TERMINAL') {
    return 'border-[#3f75a8] bg-[#24384c] text-[#78b7f5]';
  }
  if (run.outcome === 'PARTIAL_SUCCESS' || run.outcome === 'SUCCESS_WITH_SKIPS') {
    return 'border-[#8f7617] bg-[#403917] text-[#f8d84a]';
  }
  if (run.outcome === 'FAILED') {
    return 'border-[#9a4545] bg-[#482828] text-[#ff8d8d]';
  }
  return 'border-[#318d52] bg-[#20442d] text-[#5bea8f]';
}

export interface StudyProcessingRunHistoryPanelProps {
  studyInstanceUID: string;
  runHistoryTransport?: StudyProcessingRunHistoryTransport;
  canReprocessStudy?: boolean;
  reprocessingDisabled?: boolean;
  refreshVisibleStudySnapshot?: () => Promise<void> | void;
  onSelectExecutionResult?: (selection: ModelExecutionResultSelection) => void;
}

export function StudyProcessingRunHistoryPanel({
  studyInstanceUID,
  runHistoryTransport,
  canReprocessStudy = false,
  reprocessingDisabled = false,
  refreshVisibleStudySnapshot,
  onSelectExecutionResult,
}: StudyProcessingRunHistoryPanelProps) {
  const { t } = useTranslation('StudyList');
  const { ensureRunHistory, getLatestStudySummary, getRunHistoryEntry, refreshRunHistory } =
    useStudyProcessing();
  const entry = getRunHistoryEntry(studyInstanceUID);
  const history = entry.history;
  const latestSummary = getLatestStudySummary(studyInstanceUID);
  const orderedRuns = useMemo(
    () => [...(history?.runs ?? [])].sort((left, right) => right.runNumber - left.runNumber),
    [history]
  );
  const [expandedRunIds, setExpandedRunIds] = useState<Record<string, boolean>>({});
  const initializedStudyInstanceUID = useRef<string | null>(null);
  const synchronizationCoordinatorRef = useRef(createRunHistorySynchronizationCoordinator());
  const synchronizationCoordinator = synchronizationCoordinatorRef.current;
  const hadLoadedHistoryRef = useRef(false);

  useEffect(() => {
    synchronizationCoordinator.reset();
    hadLoadedHistoryRef.current = false;

    return () => synchronizationCoordinator.reset();
  }, [studyInstanceUID, synchronizationCoordinator]);

  useEffect(() => {
    if (history) {
      hadLoadedHistoryRef.current = true;
      return;
    }

    if (hadLoadedHistoryRef.current) {
      synchronizationCoordinator.reset();
      hadLoadedHistoryRef.current = false;
    }
  }, [history, synchronizationCoordinator]);

  useEffect(() => {
    void ensureRunHistory(studyInstanceUID, runHistoryTransport);
  }, [ensureRunHistory, runHistoryTransport, studyInstanceUID]);

  useEffect(() => {
    const target = getRunHistorySynchronizationTarget(latestSummary, history);
    if (!target) {
      return;
    }

    void synchronizationCoordinator.request(target, () =>
      refreshRunHistory(studyInstanceUID, runHistoryTransport)
    );
  }, [
    history,
    latestSummary,
    refreshRunHistory,
    runHistoryTransport,
    studyInstanceUID,
    synchronizationCoordinator,
  ]);

  useEffect(() => {
    if (
      !history ||
      !orderedRuns.length ||
      initializedStudyInstanceUID.current === history.studyInstanceUID
    ) {
      return;
    }

    initializedStudyInstanceUID.current = history.studyInstanceUID;
    setExpandedRunIds({ [orderedRuns[0].id]: true });
  }, [history, orderedRuns]);

  const isInitialLoading = !history && (entry.status === 'idle' || entry.status === 'loading');
  const hasLoadError = entry.status === 'error' || entry.status === 'unavailable';
  const retry = () =>
    history
      ? refreshRunHistory(studyInstanceUID, runHistoryTransport)
      : ensureRunHistory(studyInstanceUID, runHistoryTransport);
  const toggleRun = (runId: string) => {
    setExpandedRunIds(current => ({
      ...current,
      [runId]: !current[runId],
    }));
  };

  return (
    <section aria-label={t('ProcessingRunHistory', { defaultValue: 'Processing run history' })}>
      <div className="mb-4 flex min-h-[28px] items-center">
        <h2 className="text-primary-main text-sm font-bold">
          {t('Processing', { defaultValue: 'Processing' })}
        </h2>
        {history && (
          <span className="ml-auto text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingRunCount', {
              count: history.runs.length,
              defaultValue: '{{count}} runs',
            })}
          </span>
        )}
        <StudyReprocessAction
          studyInstanceUID={studyInstanceUID}
          authorized={canReprocessStudy}
          disabled={reprocessingDisabled}
          refreshVisibleStudySnapshot={refreshVisibleStudySnapshot}
          runHistoryTransport={runHistoryTransport}
        />
        {(history || entry.status === 'ready') && (
          <button
            type="button"
            className="border-white/15 ml-4 rounded-md border bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
            onClick={() => void refreshRunHistory(studyInstanceUID, runHistoryTransport)}
            disabled={entry.status === 'refreshing'}
            data-testid="study-processing-run-history-refresh"
          >
            {entry.status === 'refreshing'
              ? t('ProcessingHistoryRefreshing', { defaultValue: 'Refreshing…' })
              : t('ProcessingHistoryRefresh', { defaultValue: 'Refresh' })}
          </button>
        )}
      </div>

      {isInitialLoading && (
        <div
          className="rounded-lg bg-[#252925] px-5 py-5"
          role="status"
          aria-label={t('ProcessingHistoryLoading', {
            defaultValue: 'Loading processing run history',
          })}
          data-testid="study-processing-run-history-loading"
        >
          <div className="h-4 w-56 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-full max-w-xl animate-pulse rounded bg-white/10" />
        </div>
      )}

      {entry.status === 'partial' && (
        <div
          className="border-[#facc15]/35 mb-3 rounded-md border bg-[#403917] px-4 py-3 text-xs text-[#f8d84a]"
          role="status"
          data-testid="study-processing-run-history-partial"
        >
          {t('ProcessingHistoryPartial', {
            defaultValue: 'Some run-history information is unavailable.',
          })}
        </div>
      )}

      {hasLoadError && (
        <div
          className="border-[#f87171]/35 mb-3 flex items-center rounded-md border bg-[#482828] px-4 py-3 text-xs text-[#ffb0b0]"
          role="alert"
          data-testid="study-processing-run-history-error"
        >
          <span>
            {entry.status === 'unavailable'
              ? t('ProcessingHistoryUnavailable', {
                  defaultValue: 'Processing run history is currently unavailable.',
                })
              : t('ProcessingHistoryError', {
                  defaultValue: 'Processing run history could not be loaded.',
                })}
          </span>
          {entry.retryable && (
            <button
              type="button"
              className="ml-auto rounded border border-current px-3 py-1 font-semibold hover:bg-white/10"
              onClick={() => void retry()}
              data-testid="study-processing-run-history-retry"
            >
              {t('ProcessingHistoryRetry', { defaultValue: 'Retry' })}
            </button>
          )}
        </div>
      )}

      {history && history.runs.length === 0 ? (
        <div className="rounded-lg bg-[#252925] px-5 py-6 text-sm text-[#c5cbc5]">
          {t('ProcessingNoRunHistory', { defaultValue: 'No processing runs yet.' })}
        </div>
      ) : history ? (
        <div className="space-y-3">
          {orderedRuns.map((run, runIndex) => {
            const label = runLabel(run);
            const isExpanded = Boolean(expandedRunIds[run.id]);
            const detailsId = `study-processing-run-details-${run.id}`;

            return (
              <article
                key={run.id}
                className={`rounded-lg bg-[#252925] text-[#d9ded9] ${
                  runIndex === 0 ? 'border-l-[3px] border-[#60a5fa]' : ''
                }`}
                style={{ backgroundColor: '#252925' }}
              >
                <header>
                  <button
                    type="button"
                    className={`flex min-h-[44px] w-full items-center gap-4 px-5 py-3 text-left ${
                      isExpanded ? 'border-b border-[#404640]' : ''
                    }`}
                    onClick={() => toggleRun(run.id)}
                    aria-expanded={isExpanded}
                    aria-controls={detailsId}
                    data-testid={`study-processing-run-toggle-${run.id}`}
                  >
                    <span className="text-sm font-bold text-white">Run #{run.runNumber}</span>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${runToneClassName(
                        run
                      )}`}
                    >
                      {t(label.key, { defaultValue: label.label })}
                    </span>
                    <span className="text-xs text-[#c0c7c0]">
                      {run.trigger === 'MANUAL_REPROCESS'
                        ? t('ProcessingManualRun', { defaultValue: 'Manual · operator re-run' })
                        : run.trigger === 'LEGACY_IMPORT'
                          ? t('ProcessingLegacyRun', {
                              defaultValue: 'Reconstructed from archive',
                            })
                          : t('ProcessingAutomaticRun', { defaultValue: 'Auto · study arrival' })}
                    </span>
                    <span className="text-xs text-[#c0c7c0]">
                      {run.completedModels} / {run.expectedModels}{' '}
                      {t('ProcessingModelsComplete', { defaultValue: 'models complete' })}
                    </span>
                    <span className="ml-auto text-xs text-[#aeb6ae]">
                      {new Date(run.updatedAt).toLocaleString()}
                    </span>
                    <span
                      className="text-base text-[#aeb6ae]"
                      aria-hidden="true"
                    >
                      {isExpanded ? '⌃' : '⌄'}
                    </span>
                  </button>
                </header>

                {isExpanded && (
                  <div
                    id={detailsId}
                    className="overflow-x-auto px-5 pb-4 pt-2"
                    data-testid={`study-processing-run-details-${run.id}`}
                  >
                    <dl className="grid grid-cols-1 gap-2 py-3 text-xs text-[#b8c0b8] sm:grid-cols-3">
                      <div>
                        <dt className="font-semibold text-[#8f978f]">
                          {t('ProcessingRunStarted', { defaultValue: 'Run started' })}
                        </dt>
                        <dd className="mt-1">{formatDateTime(run.startedAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-[#8f978f]">
                          {t('ProcessingRunCompletedAt', { defaultValue: 'Run completed' })}
                        </dt>
                        <dd className="mt-1">{formatDateTime(run.completedAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-[#8f978f]">
                          {t('ProcessingRunUpdated', { defaultValue: 'Last updated' })}
                        </dt>
                        <dd className="mt-1">{formatDateTime(run.updatedAt)}</dd>
                      </div>
                    </dl>

                    {run.attentionRequired && run.attentionReasons.length > 0 && (
                      <div
                        className="mb-3 rounded-md border border-[#8f7617] bg-[#403917] px-4 py-3 text-sm text-[#f8d84a]"
                        role="status"
                        data-testid={`study-processing-run-attention-${run.id}`}
                      >
                        <div className="font-semibold">
                          {t('ProcessingRunRequiresAttention', {
                            defaultValue: 'This run requires attention',
                          })}
                        </div>
                        <ul className="mt-1 list-disc pl-5 text-xs text-[#f6df7d]">
                          {run.attentionReasons.map((reason, index) => {
                            const presentation =
                              attentionReasonPresentations[
                                reason.code as KnownProcessingAttentionReasonCode
                              ];
                            const fallbackLabel =
                              reason.message || reason.code.replaceAll('_', ' ').toLowerCase();
                            return (
                              <li key={`${reason.code}-${index}`}>
                                {presentation
                                  ? t(presentation.key, { defaultValue: presentation.label })
                                  : fallbackLabel}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {run.trigger === 'LEGACY_IMPORT' && (
                      <div
                        className="my-2 rounded-md border border-[#65717c] bg-[#343b40] px-4 py-4 text-sm text-[#d0d6dc]"
                        role="note"
                        data-testid="study-processing-legacy-history-message"
                      >
                        {run.modelExecutions.length > 0
                          ? t('ProcessingLegacyExecutionSnapshotAvailable', {
                              defaultValue:
                                'This legacy import shows the available execution snapshot. Earlier attempts and unavailable history were not reconstructed.',
                            })
                          : t('ProcessingLegacyHistoryUnavailable', {
                              defaultValue:
                                'Model-level history was not recorded for this legacy import and cannot be reconstructed.',
                            })}
                      </div>
                    )}

                    {(run.trigger !== 'LEGACY_IMPORT' || run.modelExecutions.length > 0) && (
                      <table className="w-full min-w-[900px] bg-transparent text-left">
                        <thead className="bg-transparent text-[10px] uppercase tracking-wide text-[#aeb6ae]">
                          <tr>
                            <th className="py-2">
                              {t('ProcessingModel', { defaultValue: 'Model' })}
                            </th>
                            <th>{t('ProcessingVersionLabel', { defaultValue: 'Version' })}</th>
                            <th>{t('Status')}</th>
                            <th>{t('ProcessingStarted', { defaultValue: 'Started' })}</th>
                            <th>{t('ProcessingCompletedAt', { defaultValue: 'Completed' })}</th>
                            <th>{t('ProcessingDuration', { defaultValue: 'Duration' })}</th>
                            <th>{t('ProcessingDetails', { defaultValue: 'Details' })}</th>
                          </tr>
                        </thead>
                        <tbody className="border-t border-[#4b514b] bg-transparent text-xs">
                          {run.modelExecutions.map(execution => {
                            const resultSelection = createModelExecutionResultSelection(
                              run,
                              execution
                            );

                            return (
                              <tr
                                key={execution.id}
                                className="bg-transparent"
                                style={{ backgroundColor: 'transparent' }}
                              >
                                <td className="py-2.5 font-semibold text-white">
                                  {execution.modelName}
                                </td>
                                <td className="font-mono text-[#b8c0b8]">
                                  {execution.modelVersion ? `v${execution.modelVersion}` : '—'}
                                </td>
                                <td
                                  className={`font-semibold ${executionToneClassNames[execution.status]}`}
                                >
                                  ●{' '}
                                  {t(`ProcessingExecutionStatus.${execution.status}`, {
                                    defaultValue: execution.status,
                                  })}
                                </td>
                                <td className="font-mono text-[#b8c0b8]">
                                  {formatTimestamp(execution.startedAt)}
                                </td>
                                <td className="font-mono text-[#b8c0b8]">
                                  {formatTimestamp(execution.completedAt)}
                                </td>
                                <td className="text-[#b8c0b8]">
                                  {formatDuration(execution.startedAt, execution.completedAt)}
                                </td>
                                <td className="max-w-[360px] truncate text-[#c5cbc5]">
                                  {resultSelection && onSelectExecutionResult ? (
                                    <button
                                      type="button"
                                      className="rounded border border-[#60a5fa]/70 px-3 py-1 font-semibold text-[#78b7f5] hover:bg-[#24384c] focus:outline-none focus:ring-2 focus:ring-[#78b7f5] focus:ring-offset-2 focus:ring-offset-[#252925]"
                                      onClick={() => onSelectExecutionResult(resultSelection)}
                                      aria-label={t('ProcessingViewModelResultFor', {
                                        modelName: execution.modelName,
                                        defaultValue: 'View result for {{modelName}}',
                                      })}
                                      data-testid={`study-processing-view-result-${execution.id}`}
                                    >
                                      {t('ProcessingViewModelResult', {
                                        defaultValue: 'View result',
                                      })}
                                    </button>
                                  ) : execution.error ? (
                                    <span
                                      className="text-[#f87171]"
                                      data-testid={`study-processing-model-error-${execution.id}`}
                                    >
                                      {t('ProcessingModelExecutionFailed', {
                                        defaultValue: 'Model execution failed',
                                      })}
                                      {execution.error.code && (
                                        <>
                                          {' · '}
                                          {t('ProcessingErrorCode', {
                                            defaultValue: 'Error code',
                                          })}
                                          :{' '}
                                          <code className="font-mono">{execution.error.code}</code>
                                        </>
                                      )}
                                    </span>
                                  ) : execution.skipReason ? (
                                    <span
                                      className="text-[#facc15]"
                                      data-testid={`study-processing-model-skip-${execution.id}`}
                                    >
                                      {execution.skipReason.message ||
                                        t('ProcessingModelSkipped', {
                                          defaultValue: 'Model was skipped',
                                        })}
                                      {' · '}
                                      {t('ProcessingSkipReason', {
                                        defaultValue: 'Skip reason',
                                      })}
                                      :{' '}
                                      <code className="font-mono">{execution.skipReason.code}</code>
                                    </span>
                                  ) : execution.status === 'running' ? (
                                    t('ProcessingModelRunning', {
                                      defaultValue: 'Model is running',
                                    })
                                  ) : (
                                    t('ProcessingNoAdditionalDetails', { defaultValue: '—' })
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default StudyProcessingRunHistoryPanel;
