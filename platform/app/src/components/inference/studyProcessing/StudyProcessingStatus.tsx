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
        <span className="text-sm font-medium text-[#9ca3af]">
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
        <span className="text-sm font-medium text-[#7c8b9a]">
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
      <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
      <div className="mt-1 h-3 w-20 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export default StudyProcessingStatus;
