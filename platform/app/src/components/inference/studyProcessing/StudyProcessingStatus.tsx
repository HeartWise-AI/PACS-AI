import React from 'react';
import { useTranslation } from 'react-i18next';
import { StudyProcessingStatusCell } from './StudyProcessingStatusCell';
import { useStudyProcessing } from './StudyProcessingProvider';

export interface StudyProcessingStatusProps {
  studyInstanceUID: string;
  onRetry?: () => void;
}

export function StudyProcessingStatus({ studyInstanceUID, onRetry }: StudyProcessingStatusProps) {
  const { t } = useTranslation('StudyList');
  const { getStudySummary, initialSnapshotError, initialSnapshotStatus } = useStudyProcessing();
  const summary = getStudySummary(studyInstanceUID);

  if (summary) {
    return <StudyProcessingStatusCell summary={summary} />;
  }

  if (initialSnapshotStatus === 'error') {
    return (
      <div
        className="flex min-w-[208px] items-center gap-3"
        role="status"
        aria-label={t('ProcessingStatusUnavailable', {
          defaultValue: 'Processing status unavailable',
        })}
        title={
          initialSnapshotError ||
          t('ProcessingStatusServiceUnavailable', {
            defaultValue: 'The processing status service is unavailable.',
          })
        }
        data-testid="study-processing-unavailable"
      >
        <span className="border-[#9ca3af]/35 bg-[#9ca3af]/15 inline-flex h-[22px] items-center gap-2 rounded-full border px-3 text-xs font-semibold text-[#9ca3af]">
          <span
            className="h-[7px] w-[7px] rounded-full bg-[#9ca3af]"
            aria-hidden="true"
          />
          {t('ProcessingStatusUnavailableShort', {
            defaultValue: 'Status unavailable',
          })}
        </span>
        {onRetry && (
          <button
            type="button"
            className="border-white/15 rounded-md border bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
            onClick={event => {
              event.stopPropagation();
              onRetry();
            }}
            aria-label={t('ProcessingStatusRetry', {
              defaultValue: 'Retry processing status',
            })}
            data-testid="study-processing-status-retry"
          >
            {t('ProcessingHistoryRetry', { defaultValue: 'Retry' })}
          </button>
        )}
      </div>
    );
  }

  if (initialSnapshotStatus === 'ready') {
    return (
      <div
        className="min-w-[208px]"
        role="status"
        aria-label={t('ProcessingNoStatusYet', {
          defaultValue: 'No processing status yet',
        })}
        title={t('ProcessingNoStatusDescription', {
          defaultValue: 'This study has not entered the processing pipeline.',
        })}
        data-testid="study-processing-empty"
      >
        <span className="border-[#7c8b9a]/35 bg-[#7c8b9a]/15 inline-flex h-[22px] items-center gap-2 rounded-full border px-3 text-xs font-semibold text-[#7c8b9a]">
          <span
            className="h-[7px] w-[7px] rounded-full bg-[#7c8b9a]"
            aria-hidden="true"
          />
          {t('ProcessingNoStatusYetShort', {
            defaultValue: 'No status yet',
          })}
        </span>
      </div>
    );
  }

  return (
    <div
      className="min-w-[208px]"
      role="status"
      aria-label={t('ProcessingStatusLoading', {
        defaultValue: 'Loading processing status',
      })}
      data-testid="study-processing-loading"
    >
      <div className="h-[22px] w-24 animate-pulse rounded-full bg-white/10" />
      <div className="mt-2 h-[6px] w-[208px] animate-pulse rounded-full bg-white/10" />
    </div>
  );
}

export default StudyProcessingStatus;
