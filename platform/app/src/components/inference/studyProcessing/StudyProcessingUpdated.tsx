import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStudyProcessing } from './StudyProcessingProvider';

export function formatStudyProcessingRelativeTime(
  updatedAt: string,
  locale: string | undefined,
  now: number = Date.now()
): string {
  const updatedAtMilliseconds = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMilliseconds)) {
    return '—';
  }

  const differenceMinutes = Math.round((updatedAtMilliseconds - now) / 60000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (differenceMinutes === 0) {
    return formatter.format(0, 'second');
  }

  if (Math.abs(differenceMinutes) < 60) {
    return formatter.format(differenceMinutes, 'minute');
  }

  const differenceHours = Math.round(differenceMinutes / 60);
  if (Math.abs(differenceHours) < 24) {
    return formatter.format(differenceHours, 'hour');
  }

  const differenceDays = Math.round(differenceHours / 24);
  return formatter.format(differenceDays, 'day');
}

export interface StudyProcessingUpdatedProps {
  studyInstanceUID: string;
}

export function StudyProcessingUpdated({ studyInstanceUID }: StudyProcessingUpdatedProps) {
  const { i18n, t } = useTranslation('StudyList');
  const { getStudySummary } = useStudyProcessing();
  const summary = getStudySummary(studyInstanceUID);

  if (!summary) {
    return <span className="text-xs text-white/35">—</span>;
  }

  const exactTimestamp = new Date(summary.updatedAt).toLocaleString(i18n.language);
  const accessibleLabel =
    summary.version === null
      ? t('ProcessingUpdatedAt', {
          timestamp: exactTimestamp,
          defaultValue: 'Updated {{timestamp}}',
        })
      : t('ProcessingUpdatedAtVersion', {
          timestamp: exactTimestamp,
          version: summary.version,
          defaultValue: 'Updated {{timestamp}}, version {{version}}',
        });

  return (
    <div
      className="min-w-[92px]"
      title={exactTimestamp}
      aria-label={accessibleLabel}
    >
      <div className="text-xs text-[#d1d5db]">
        {formatStudyProcessingRelativeTime(summary.updatedAt, i18n.language)}
      </div>
      {summary.version !== null && (
        <div className="mt-0.5 font-mono text-[10px] text-[#9ca3af]">
          {t('ProcessingVersion', {
            version: summary.version,
            defaultValue: 'version {{version}}',
          })}
        </div>
      )}
    </div>
  );
}

export default StudyProcessingUpdated;
