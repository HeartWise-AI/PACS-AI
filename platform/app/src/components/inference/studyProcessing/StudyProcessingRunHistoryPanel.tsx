import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelExecution, ProcessingRun } from './types';
import { createStudyProcessingRunHistoryFixture } from './runHistoryFixtureAdapter';
import { useStudyProcessing } from './StudyProcessingProvider';

const executionToneClassNames: Record<ModelExecution['status'], string> = {
  pending: 'text-[#c3c9c3]',
  queued: 'text-[#c3c9c3]',
  running: 'text-[#60a5fa]',
  completed: 'text-[#4ade80]',
  failed: 'text-[#f87171]',
  skipped: 'text-[#facc15]',
  cancelled: 'text-[#b2bac2]',
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
}

export function StudyProcessingRunHistoryPanel({
  studyInstanceUID,
}: StudyProcessingRunHistoryPanelProps) {
  const { t } = useTranslation('StudyList');
  const { getStudySummary } = useStudyProcessing();
  const summary = getStudySummary(studyInstanceUID);

  if (!summary) {
    return null;
  }

  const history = createStudyProcessingRunHistoryFixture(summary);

  return (
    <section aria-label={t('ProcessingRunHistory', { defaultValue: 'Processing run history' })}>
      <div className="mb-4 flex items-center">
        <h2 className="text-sm font-bold text-primary-main">
          {t('Processing', { defaultValue: 'Processing' })}
        </h2>
        <span className="ml-5 text-xs text-[#b4bbb4]">
          {t('ProcessingLoadedOnDemand', {
            defaultValue: 'Loaded on demand for this study only',
          })}
        </span>
        <span className="ml-auto text-xs font-semibold text-[#c5cbc5]">
          {t('ProcessingRunCount', {
            count: history.runs.length,
            defaultValue: '{{count}} runs',
          })}
        </span>
      </div>

      {history.runs.length === 0 ? (
        <div className="rounded-lg bg-[#252925] px-5 py-6 text-sm text-[#c5cbc5]">
          {t('ProcessingNoRunHistory', { defaultValue: 'No processing runs yet.' })}
        </div>
      ) : (
        <div className="space-y-3">
          {history.runs.map((run, runIndex) => {
            const label = runLabel(run);

            return (
              <article
                key={run.id}
                className={`rounded-lg bg-[#252925] text-[#d9ded9] ${
                  runIndex === 0 ? 'border-l-[3px] border-[#60a5fa]' : ''
                }`}
                style={{ backgroundColor: '#252925' }}
              >
                <header className="flex min-h-[44px] items-center gap-4 border-b border-[#404640] px-5 py-3">
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
                        ? t('ProcessingLegacyRun', { defaultValue: 'Reconstructed from archive' })
                        : t('ProcessingAutomaticRun', { defaultValue: 'Auto · study arrival' })}
                  </span>
                  <span className="text-xs text-[#c0c7c0]">
                    {run.completedModels} / {run.expectedModels}{' '}
                    {t('ProcessingModelsComplete', { defaultValue: 'models complete' })}
                  </span>
                  <span className="ml-auto text-xs text-[#aeb6ae]">
                    {new Date(run.updatedAt).toLocaleString()}
                  </span>
                </header>

                {runIndex === 0 && (
                  <div className="overflow-x-auto px-5 pb-4 pt-2">
                    <table className="w-full min-w-[900px] bg-transparent text-left">
                      <thead className="bg-transparent text-[10px] uppercase tracking-wide text-[#aeb6ae]">
                        <tr>
                          <th className="py-2">
                            {t('ProcessingModel', { defaultValue: 'Model' })}
                          </th>
                          <th>{t('ProcessingVersionLabel', { defaultValue: 'Version' })}</th>
                          <th>{t('Status')}</th>
                          <th>{t('ProcessingStarted', { defaultValue: 'Started' })}</th>
                          <th>{t('ProcessingDuration', { defaultValue: 'Duration' })}</th>
                          <th>{t('ProcessingDetails', { defaultValue: 'Details' })}</th>
                        </tr>
                      </thead>
                      <tbody className="border-t border-[#4b514b] bg-transparent text-xs">
                        {run.modelExecutions.map(execution => (
                          <tr
                            key={execution.id}
                            className="bg-transparent"
                            style={{ backgroundColor: 'transparent' }}
                          >
                            <td className="py-2.5 font-semibold text-white">
                              {execution.modelName}
                            </td>
                            <td className="font-mono text-[#b8c0b8]">v{execution.modelVersion}</td>
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
                            <td className="text-[#b8c0b8]">
                              {formatDuration(execution.startedAt, execution.completedAt)}
                            </td>
                            <td className="max-w-[360px] truncate text-[#c5cbc5]">
                              {execution.error ? (
                                <span className="text-[#f87171]">
                                  {execution.error.code || execution.error.message}
                                </span>
                              ) : execution.skipReason ? (
                                <span className="text-[#facc15]">
                                  {t('ProcessingSkipReason', { defaultValue: 'Skip reason' })}:{' '}
                                  {execution.skipReason.code}
                                </span>
                              ) : execution.status === 'running' ? (
                                t('ProcessingModelRunning', { defaultValue: 'Model is running' })
                              ) : (
                                t('ProcessingNoAdditionalDetails', { defaultValue: '—' })
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default StudyProcessingRunHistoryPanel;
