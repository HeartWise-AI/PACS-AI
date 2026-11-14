import React from 'react';
import { useTranslation } from 'react-i18next';
import { viewerResultKey } from './viewerResultsModel';
import type { ViewerModelResult } from './types';

export interface ViewerModelResultReadyNoticeProps {
  results: ViewerModelResult[];
  onView: (result: ViewerModelResult) => void;
  onDismiss: (result: ViewerModelResult) => void;
}

/** Offers to open results of runs started from the viewer once they complete. */
export function ViewerModelResultReadyNotice({
  results,
  onView,
  onDismiss,
}: ViewerModelResultReadyNoticeProps) {
  const { t } = useTranslation('AIModelButton');

  if (!results.length) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex w-80 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {results.map(result => (
        <div
          key={viewerResultKey(result)}
          className="border-white/15 rounded-lg border bg-[#232823] p-3 text-sm text-white shadow-xl"
          data-testid="viewer-model-result-ready"
        >
          <p>{t('ViewerRunReady', { modelName: result.modelName })}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1 text-xs text-white/80 hover:bg-white/10"
              onClick={() => onDismiss(result)}
            >
              {t('ViewerRunReadyDismiss')}
            </button>
            <button
              type="button"
              className="rounded-md bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)] px-3 py-1 text-xs font-semibold text-white"
              onClick={() => onView(result)}
              data-testid="viewer-model-result-ready-view"
            >
              {t('ViewerRunReadyView')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ViewerModelResultReadyNotice;
