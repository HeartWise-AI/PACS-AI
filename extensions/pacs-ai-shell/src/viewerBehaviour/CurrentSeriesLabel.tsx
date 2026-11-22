import React, { useEffect, useState } from 'react';
import { useSystem } from '@ohif/core';
import { useViewportGrid } from '@ohif/ui-next';

/** Toolbar button type (uiType) of the current-series label. */
export const CURRENT_SERIES_UI_TYPE = 'pacsAi.currentSeries';
/** Toolbar button id of the current-series label. */
export const CURRENT_SERIES_BUTTON_ID = 'PacsAiCurrentSeries';

type DisplaySetLike = {
  displaySetInstanceUID: string;
  StudyInstanceUID?: string;
  SeriesNumber?: number | string;
  SeriesDescription?: string;
  Modality?: string;
  imageIds?: unknown[];
  numImageFrames?: number;
  images?: unknown[];
  instances?: unknown[];
  unsupported?: boolean;
  excludeFromThumbnailBrowser?: boolean;
};

/** Modalities that are not image series (reports, segmentations, documents, ...). */
export const NON_IMAGE_MODALITIES = [
  'SR',
  'SEG',
  'RTSTRUCT',
  'RTPLAN',
  'RTDOSE',
  'PR',
  'KO',
  'DOC',
  'PMAP',
];

/**
 * Number of images of a display set. `imageIds` is filled only once the
 * display set has been loaded into a viewport (CornerstoneCacheService), so
 * the frame and instance counts that OHIF sets when it creates the display
 * set are used as well; otherwise only the series already viewed would count.
 */
function imageCount(displaySet: DisplaySetLike): number {
  const lengthOf = (list: unknown) => (Array.isArray(list) ? list.length : 0);
  return Math.max(
    lengthOf(displaySet.imageIds),
    Number(displaySet.numImageFrames) || 0,
    lengthOf(displaySet.images),
    lengthOf(displaySet.instances)
  );
}

/** An image series: an image modality with images to show. */
export function isImageSeries(displaySet?: DisplaySetLike): boolean {
  return (
    !!displaySet &&
    !displaySet.unsupported &&
    !NON_IMAGE_MODALITIES.includes(displaySet.Modality ?? '') &&
    imageCount(displaySet) > 0
  );
}

function seriesDetails(displaySet: DisplaySetLike): string {
  return [
    displaySet.SeriesNumber !== undefined && displaySet.SeriesNumber !== ''
      ? `#${displaySet.SeriesNumber}`
      : '',
    displaySet.SeriesDescription || '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Text after "Series:" for a viewport.
 *
 * - "#number description" of the series the viewport shows;
 * - preceded by "n/N" when that display set is an image series: its position
 *   among the image series of its own study (same StudyInstanceUID; no SR,
 *   SEG, RTSTRUCT, PR, KO, PDF or other display set without images), in the
 *   order the PACS-AI study browser lists that study's image thumbnails
 *   (`displaySetService.getActiveDisplaySets()` order; the browser puts the
 *   series without images after them). The other studies of the patient
 *   that the study browser loads are not counted. The arrow keys may walk
 *   on into another study; the count is then that study's.
 *
 * Empty when the viewport shows nothing known.
 */
export function currentSeriesText(
  displaySetInstanceUIDs: string[] = [],
  activeDisplaySets: DisplaySetLike[] = []
): string {
  const uid = displaySetInstanceUIDs[0];
  const current = uid
    ? activeDisplaySets.find(displaySet => displaySet.displaySetInstanceUID === uid)
    : undefined;
  if (!current) {
    return '';
  }
  const details = seriesDetails(current);
  if (!isImageSeries(current)) {
    return details;
  }
  const studySeries = activeDisplaySets.filter(
    displaySet =>
      displaySet.StudyInstanceUID === current.StudyInstanceUID &&
      !displaySet.excludeFromThumbnailBrowser &&
      isImageSeries(displaySet)
  );
  const index = studySeries.indexOf(current);
  if (index < 0) {
    return details;
  }
  const position = `${index + 1}/${studySeries.length}`;
  return details ? `${position} · ${details}` : position;
}

/**
 * "Series: <current series>" in the viewport's action bar (F15), placed by
 * modes/pacs-ai in the `viewportActionMenu.topMiddle` toolbar section, which
 * OHIF renders per viewport with the viewport's id, and only while that
 * viewport is active or hovered. It follows the series
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
