import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStudyProcessing } from './StudyProcessingProvider';

export function StudyProcessingConnectionBanner() {
  const { t } = useTranslation('StudyList');
  const { isRealtimeDataStale, realtimeConnectionError, realtimeConnectionStatus } =
    useStudyProcessing();

  if (realtimeConnectionStatus === 'connected' && !isRealtimeDataStale) {
    return null;
  }

  const isUnavailable =
    realtimeConnectionStatus === 'degraded' || realtimeConnectionStatus === 'disconnected';
  const label = isUnavailable
    ? t('ProcessingConnectionUnavailable', {
        defaultValue: 'Live processing updates are unavailable.',
      })
    : t('ProcessingConnectionReconnecting', {
        defaultValue: 'Reconnecting to live processing updates…',
      });

  return (
    <div
      className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
        isUnavailable
          ? 'border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]'
          : 'border-[#facc15]/30 bg-[#facc15]/10 text-[#facc15]'
      }`}
      role="status"
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          isUnavailable ? 'bg-[#f87171]' : 'animate-pulse bg-[#facc15]'
        }`}
        aria-hidden="true"
      />
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-white/45">
        {realtimeConnectionError ||
          t('ProcessingConnectionSnapshotNotice', {
            defaultValue: 'The last worklist snapshot remains visible.',
          })}
      </span>
    </div>
  );
}

export default StudyProcessingConnectionBanner;
