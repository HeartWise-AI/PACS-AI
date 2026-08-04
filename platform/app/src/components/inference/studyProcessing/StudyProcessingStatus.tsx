import React from 'react';
import { useTranslation } from 'react-i18next';
import { StudyProcessingStatusCell } from './StudyProcessingStatusCell';
import { useStudyProcessing } from './StudyProcessingProvider';

export interface StudyProcessingStatusProps {
  studyInstanceUID: string;
}

export function StudyProcessingStatus({ studyInstanceUID }: StudyProcessingStatusProps) {
  const { t } = useTranslation('StudyList');
  const { getStudySummary, initialSnapshotError, initialSnapshotStatus } = useStudyProcessing();
  const summary = getStudySummary(studyInstanceUID);

  if (summary) {
    return <StudyProcessingStatusCell summary={summary} />;
  }

  if (initialSnapshotStatus === 'error') {
    return (
      <div
        className="min-w-[208px]"
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
        <span className="inline-flex h-[22px] items-center gap-2 rounded-full border border-[#9ca3af]/35 bg-[#9ca3af]/15 px-3 text-xs font-semibold text-[#9ca3af]">
          <span
            className="h-[7px] w-[7px] rounded-full bg-[#9ca3af]"
            aria-hidden="true"
          />
          {t('ProcessingStatusUnavailableShort', {
            defaultValue: 'Status unavailable',
          })}
        </span>
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
        <span className="inline-flex h-[22px] items-center gap-2 rounded-full border border-[#7c8b9a]/35 bg-[#7c8b9a]/15 px-3 text-xs font-semibold text-[#7c8b9a]">
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
