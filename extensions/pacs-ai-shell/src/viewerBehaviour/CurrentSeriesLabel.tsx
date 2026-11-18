import React, { useEffect, useState } from 'react';
import { useSystem } from '@ohif/core';
import { useViewportGrid } from '@ohif/ui-next';

/** Toolbar button type (uiType) of the current-series label. */
export const CURRENT_SERIES_UI_TYPE = 'pacsAi.currentSeries';
/** Toolbar button id of the current-series label. */
export const CURRENT_SERIES_BUTTON_ID = 'PacsAiCurrentSeries';

type DisplaySetLike = {
  displaySetInstanceUID: string;
  SeriesNumber?: number | string;
  SeriesDescription?: string;
};

/**
 * Text after "Series:" for a viewport: the position of its series among the
 * study's display sets, in the order the arrow keys walk through them
 * (`displaySetService.getActiveDisplaySets()`, as the
 * `updateViewportDisplaySet` command uses), then the series number and
 * description. Empty when the viewport shows nothing known.
 */
export function currentSeriesText(
  displaySetInstanceUIDs: string[] = [],
  activeDisplaySets: DisplaySetLike[] = []
): string {
  const uid = displaySetInstanceUIDs[0];
  if (!uid) {
    return '';
  }
  const index = activeDisplaySets.findIndex(
    displaySet => displaySet.displaySetInstanceUID === uid
  );
  if (index < 0) {
    return '';
  }
  const displaySet = activeDisplaySets[index];
  const details = [
    displaySet.SeriesNumber !== undefined && displaySet.SeriesNumber !== ''
      ? `#${displaySet.SeriesNumber}`
      : '',
    displaySet.SeriesDescription || '',
  ]
    .filter(Boolean)
    .join(' ');
  const position = `${index + 1}/${activeDisplaySets.length}`;
  return details ? `${position} · ${details}` : position;
}

/**
 * "Series: <current series>" in the viewport's action bar (F15), placed by
 * modes/pacs-ai in the `viewportActionMenu.topMiddle` toolbar section, which
 * OHIF renders per viewport with the viewport's id. It follows the series
 * shown in the viewport (arrow keys, thumbnails, hanging protocol). PACS-AI
 * had added this to @ohif/ui-next's ViewportActionBar, which OHIF 3.11 no
 * longer renders, so the label had been missing.
 */
function CurrentSeriesLabel({ viewportId }: { viewportId?: string; [key: string]: unknown }) {
  const { servicesManager } = useSystem();
  const { displaySetService } = servicesManager.services;
  const [viewportGrid] = useViewportGrid();
  const [, setDisplaySetsVersion] = useState(0);

  useEffect(() => {
    const bump = () => setDisplaySetsVersion(version => version + 1);
    const { EVENTS } = displaySetService;
    const subscriptions = [
      EVENTS.DISPLAY_SETS_ADDED,
      EVENTS.DISPLAY_SETS_CHANGED,
      EVENTS.DISPLAY_SETS_REMOVED,
    ]
      .filter(Boolean)
      .map(event => displaySetService.subscribe(event, bump));
    return () => subscriptions.forEach(subscription => subscription?.unsubscribe?.());
  }, [displaySetService]);

  const id = viewportId ?? viewportGrid?.activeViewportId;
  const viewport = id ? viewportGrid?.viewports?.get?.(id) : undefined;
  const text = currentSeriesText(
    viewport?.displaySetInstanceUIDs,
    displaySetService.getActiveDisplaySets() || []
  );

  if (!text) {
    return null;
  }

  return (
    <div
      className="pointer-events-none flex flex-row items-center gap-1 whitespace-nowrap px-1 text-base text-white"
      data-cy="pacs-ai-current-series"
    >
      <span>Series: </span>
      <span className="max-w-[24rem] overflow-hidden text-ellipsis">{text}</span>
    </div>
  );
}

export default CurrentSeriesLabel;

/**
 * Registers the label as a toolbar button and puts it in the viewport action
 * bar. Run from the mode's onModeEnter (the toolbar service starts empty for
 * each mode).
 */
export function addCurrentSeriesLabel(toolbarService): void {
  if (!toolbarService) {
    return;
  }
  toolbarService.register([
    {
      id: CURRENT_SERIES_BUTTON_ID,
      uiType: CURRENT_SERIES_UI_TYPE,
      props: {},
    },
  ]);
  toolbarService.updateSection(toolbarService.sections.viewportActionMenu.topMiddle, [
    CURRENT_SERIES_BUTTON_ID,
  ]);
}
