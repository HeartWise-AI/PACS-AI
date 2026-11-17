/**
 * The PACS-AI study browser in place of `@ohif/extension-measurement-tracking`'s
 * seriesList panel: OHIF v3.11.1
 * extensions/measurement-tracking/src/panels/PanelStudyBrowserTracking/
 * (index.tsx and PanelStudyBrowserTracking.tsx) rendering the PACS-AI panel
 * instead of the default extension's PanelStudyBrowser. The tracking context
 * is read through the extension manager (the hook is not exported).
 */
import React, { useContext, useEffect } from 'react';
import { useSystem } from '@ohif/core';
import PacsAiPanelStudyBrowser from './PacsAiPanelStudyBrowser';
import { UntrackSeriesModal } from './UntrackSeriesModal';
import { usePanelStudyBrowserProps } from './usePanelStudyBrowserProps';

export const TRACKED_MEASUREMENTS_CONTEXT_ID =
  '@ohif/extension-measurement-tracking.contextModule.TrackedMeasurementsContext';

const NO_CONTEXT = React.createContext(null);

function useTrackedMeasurements() {
  const { extensionManager } = useSystem();
  const entry = extensionManager.getModuleEntry(TRACKED_MEASUREMENTS_CONTEXT_ID) as
    | { context: React.Context<any> }
    | undefined;
  return useContext(entry?.context ?? NO_CONTEXT);
}

const thumbnailNoImageModalities = ['SR', 'SEG', 'RTSTRUCT', 'RTPLAN', 'RTDOSE', 'PMAP'];

/**
 * Panel component for the Study Browser with tracking capabilities
 */
export default function PacsAiTrackedSeriesListPanel() {
  const { getImageSrc, getStudiesForPatientByMRN, requestDisplaySetCreationForStudy, dataSource } =
    usePanelStudyBrowserProps();
  const { servicesManager } = useSystem();
  const { displaySetService, uiModalService, measurementService, viewportGridService } =
    servicesManager.services;
  const [trackedMeasurements, sendTrackedMeasurementsEvent] = useTrackedMeasurements();
  const { trackedSeries } = trackedMeasurements.context;

  const checkDirtyMeasurements = displaySetInstanceUID => {
    const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
    if (displaySet.Modality === 'SR') {
      const activeViewportId = viewportGridService.getActiveViewportId();
      sendTrackedMeasurementsEvent('CHECK_DIRTY', {
        viewportId: activeViewportId,
        displaySetInstanceUID: displaySetInstanceUID,
      });
    }
  };

  useEffect(() => {
    const subscriptionOndropFired = viewportGridService.subscribe(
      viewportGridService.EVENTS.VIEWPORT_ONDROP_HANDLED,
      ({ eventData }) => {
        checkDirtyMeasurements(eventData.displaySetInstanceUID);
      }
    );

    return () => {
      subscriptionOndropFired.unsubscribe();
    };
  }, []);
  const onClickUntrack = displaySetInstanceUID => {
    const onConfirm = () => {
      const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
      sendTrackedMeasurementsEvent('UNTRACK_SERIES', {
        SeriesInstanceUID: displaySet.SeriesInstanceUID,
      });
      const measurements = measurementService.getMeasurements();
      measurements.forEach(m => {
        if (m.referenceSeriesUID === displaySet.SeriesInstanceUID) {
          measurementService.remove(m.uid);
        }
      });
    };

    uiModalService.show({
      title: 'Untrack Series',
      content: UntrackSeriesModal,
      contentProps: {
        onConfirm,
        message: 'Are you sure you want to untrack this series?',
      },
    });
  };

  // Custom mapping function to add tracking data to display sets
  const mapDisplaySetsWithTracking = (
    displaySets,
    displaySetLoadingState,
    thumbnailImageSrcMap,
    viewports
  ) => {
    const thumbnailDisplaySets = [];
    const thumbnailNoImageDisplaySets = [];
    displaySets
      .filter(ds => !ds.excludeFromThumbnailBrowser)
      .forEach(ds => {
        const { thumbnailSrc, displaySetInstanceUID } = ds;
        const componentType = getComponentType(ds);

        const array =
          componentType === 'thumbnailTracked' ? thumbnailDisplaySets : thumbnailNoImageDisplaySets;

        const loadingProgress = displaySetLoadingState?.[displaySetInstanceUID];

        array.push({
          displaySetInstanceUID,
          description: ds.SeriesDescription || '',
          seriesNumber: ds.SeriesNumber,
          modality: ds.Modality,
          seriesDate: ds.SeriesDate ? new Date(ds.SeriesDate).toLocaleDateString() : '',
          numInstances: ds.numImageFrames,
          loadingProgress,
          countIcon: ds.countIcon,
          messages: ds.messages,
          StudyInstanceUID: ds.StudyInstanceUID,
          componentType,
          imageSrc: thumbnailSrc || thumbnailImageSrcMap[displaySetInstanceUID],
          dragData: {
            type: 'displayset',
            displaySetInstanceUID,
          },
          isTracked: trackedSeries.includes(ds.SeriesInstanceUID),
          isHydratedForDerivedDisplaySet: ds.isHydrated,
        });
      });

    return [...thumbnailDisplaySets, ...thumbnailNoImageDisplaySets];
  };

  // Override component type to use tracking specific components
  const getComponentType = ds => {
    if (
      thumbnailNoImageModalities.includes(ds.Modality) ||
      ds.unsupported ||
      ds.thumbnailSrc === null
    ) {
      return 'thumbnailNoImage';
    }
    return 'thumbnailTracked';
  };

  return (
    <PacsAiPanelStudyBrowser
      getImageSrc={getImageSrc}
      getStudiesForPatientByMRN={getStudiesForPatientByMRN}
      requestDisplaySetCreationForStudy={requestDisplaySetCreationForStudy}
      dataSource={dataSource}
      customMapDisplaySets={mapDisplaySetsWithTracking}
      onClickUntrack={onClickUntrack}
      onDoubleClickThumbnailHandlerCallBack={checkDirtyMeasurements}
    />
  );
}
