import React from 'react';
import { useTranslation } from 'react-i18next';
import { useViewerModelResults } from './ViewerModelResultsProvider';

/** Study-browser legend for the selected-view badges of the open result. */
export function SelectedViewsLegend() {
  const { t } = useTranslation('AIModelButton');
  const viewerResults = useViewerModelResults();
  const openedResult = viewerResults?.openedResult;

  if (!openedResult) {
    return null;
  }

  const { result, minimized } = openedResult;
  return (
    <div
      className="mx-[5px] mt-[4px] flex flex-col gap-1 rounded bg-white/10 px-2 py-2 text-xs text-white"
      data-testid="selected-views-legend"
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3ef1d1] text-[10px] font-bold text-black"
          aria-hidden="true"
        >
          1
        </span>
        <span className="min-w-0 grow truncate">
          {result.selectedViews === null
            ? t('ViewerViewsNotRecorded')
            : t('ViewerSelectedViewsLegend', {
                modelName: result.modelName,
                count: result.selectedViews.length,
              })}
        </span>
      </div>
      <div className="flex justify-end gap-2">
        {minimized && (
          <button
            type="button"
            className="rounded px-2 py-0.5 hover:bg-white/20"
            onClick={() => viewerResults.setResultMinimized(false)}
          >
            {t('ViewerShowReport')}
          </button>
        )}
        <button
          type="button"
          className="rounded px-2 py-0.5 hover:bg-white/20"
          onClick={viewerResults.closeResult}
          data-testid="selected-views-legend-clear"
        >
          {t('ViewerClearSelectedViews')}
        </button>
      </div>
    </div>
  );
}

export default SelectedViewsLegend;
