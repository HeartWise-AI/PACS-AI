// NOTE: PACS changes is applied to autoplay certain modalities
// See https://github.com/HeartWise-AI/PACS-AI/commit/31971ad7c70b8bd2e87340c9dd022e85a4c24c13 for unmodified version

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useCine } from '@ohif/ui-next';
import { Enums, eventTarget, cache } from '@cornerstonejs/core';
import { useAppConfig } from '@state';
import { useLocation } from 'react-router-dom';

function WrappedCinePlayer({
  enabledVPElement,
  viewportId,
  servicesManager,
}: withAppTypes<{
  enabledVPElement: HTMLElement;
  viewportId: string;
}>) {
  const { customizationService, displaySetService, viewportGridService } = servicesManager.services;
  const [{ isCineEnabled, cines }, cineService] = useCine();
  const [newStackFrameRate, setNewStackFrameRate] = useState(24);
  const [dynamicInfo, setDynamicInfo] = useState(null);
  const [appConfig] = useAppConfig();
  const isMountedRef = useRef(null);

  const location = useLocation(); // Get the current location

  useEffect(() => {
    // this will run when the location (i.e., the page) changes
    cineService.setIsCineEnabled(false);
  }, [location]); // add location to the dependency array

  const cineHandler = useCallback(() => {
    if (!cines?.[viewportId] || !enabledVPElement) {
      return;
    }

    const { isPlaying = false, frameRate = 24 } = cines[viewportId];
    const validFrameRate = Math.max(frameRate, 1);

    return isPlaying
      ? cineService.playClip(enabledVPElement, { framesPerSecond: validFrameRate, viewportId })
      : cineService.stopClip(enabledVPElement);
  }, [cines, viewportId, enabledVPElement, cineService]);

  const newDisplaySetHandler = useCallback(() => {
    const { viewports } = viewportGridService.getState();
    const viewport = viewports.get(viewportId);

    if (!viewport) {
      console.error(`No viewport found for id: ${viewportId}`);
      return;
    }

    const { displaySetInstanceUIDs } = viewport;
    let frameRate = 24;
    let isPlaying = cines[viewportId]?.isPlaying || false;

    // extract modality check into a separate function
    const shouldAutoPlayModality = (modality: string): boolean => {
      return modality.includes('US') || modality.includes('XA');
    };

    // extract frame rate calculation into a separate function
    const calculateFrameRate = (displaySet: any): number => {
      if (displaySet.instance?.CineRate) {
        // DICOM tag (0018,0040) - preferred frame rate
        return displaySet.instance.CineRate;
      }
      if (displaySet.FrameRate) {
        // DICOM tag (0018,1063) - frame time in milliseconds
        return Math.round(1000 / displaySet.FrameRate);
      }
      return 24; // default frame rate
    };

    // process each display set
    for (const displaySetInstanceUID of displaySetInstanceUIDs) {
      const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

      // check if modality should autoplay
      if (shouldAutoPlayModality(displaySet.Modality)) {
        isPlaying = true;
        cineService.setIsCineEnabled(true);
      }

      // Skip if viewport is not enabled or cine is disabled
      if (!enabledVPElement || !isCineEnabled) {
        continue;
      }

      // update frame rate
      frameRate = calculateFrameRate(displaySet);

      // enable autoplay based on config if frame rate is available
      if (frameRate !== 24 && appConfig.autoPlayCine) {
        isPlaying = true;
      }

      // check if the displaySet is dynamic and set the dynamic info
      if (displaySet.isDynamicVolume) {
        const { dynamicVolumeInfo } = displaySet;
        const numDimensionGroups = dynamicVolumeInfo.timePoints.length;
        const label = dynamicVolumeInfo.splittingTag;
        const dimensionGroupNumber = dynamicVolumeInfo.dimensionGroupNumber || 1;
        setDynamicInfo({
          volumeId: displaySet.displaySetInstanceUID,
          dimensionGroupNumber,
          numDimensionGroups,
          label,
        });
      } else {
        setDynamicInfo(null);
      }
    }

    // update cine state
    if (isPlaying) {
      cineService.setIsCineEnabled(isPlaying);
    }
    cineService.setCine({ id: viewportId, isPlaying, frameRate });
    setNewStackFrameRate(frameRate);
  }, [
    displaySetService,
    viewportId,
    viewportGridService,
    cines,
    isCineEnabled,
    enabledVPElement,
    appConfig?.autoPlayCine,
  ]);

  useEffect(() => {
    isMountedRef.current = true;

    newDisplaySetHandler();

    return () => {
      isMountedRef.current = false;
    };
  }, [isCineEnabled, newDisplaySetHandler]);

  useEffect(() => {
    if (!isCineEnabled) {
      return;
    }

    cineHandler();
  }, [isCineEnabled, cineHandler, enabledVPElement]);

  /**
   * Use effect for handling new display set
   */
  useEffect(() => {
    if (!enabledVPElement) {
      return;
    }

    enabledVPElement.addEventListener(Enums.Events.VIEWPORT_NEW_IMAGE_SET, newDisplaySetHandler);
    // this doesn't makes sense that we are listening to this event on viewport element
    enabledVPElement.addEventListener(
      Enums.Events.VOLUME_VIEWPORT_NEW_VOLUME,
      newDisplaySetHandler
    );

    return () => {
      cineService.setCine({ id: viewportId, isPlaying: false });

      enabledVPElement.removeEventListener(
        Enums.Events.VIEWPORT_NEW_IMAGE_SET,
        newDisplaySetHandler
      );
      enabledVPElement.removeEventListener(
        Enums.Events.VOLUME_VIEWPORT_NEW_VOLUME,
        newDisplaySetHandler
      );
    };
  }, [enabledVPElement, newDisplaySetHandler, viewportId]);

  useEffect(() => {
    if (!cines || !cines[viewportId] || !enabledVPElement || !isMountedRef.current) {
      return;
    }

    cineHandler();

    return () => {
      cineService.stopClip(enabledVPElement, { viewportId });
    };
  }, [cines, viewportId, cineService, enabledVPElement, cineHandler]);

  if (!isCineEnabled) {
    return null;
  }

  const cine = cines[viewportId];
  const isPlaying = cine?.isPlaying || false;

  return (
    <RenderCinePlayer
      viewportId={viewportId}
      cineService={cineService}
      newStackFrameRate={newStackFrameRate}
      isPlaying={isPlaying}
      dynamicInfo={dynamicInfo}
      customizationService={customizationService}
    />
  );
}

function RenderCinePlayer({
  viewportId,
  cineService,
  newStackFrameRate,
  isPlaying,
  dynamicInfo: dynamicInfoProp,
  customizationService,
}) {
  const CinePlayerComponent = customizationService.getCustomization('cinePlayer');

  const [dynamicInfo, setDynamicInfo] = useState(dynamicInfoProp);

  useEffect(() => {
    setDynamicInfo(dynamicInfoProp);
  }, [dynamicInfoProp]);

  /**
   * Use effect for handling 4D time index changed
   */
  useEffect(() => {
    if (!dynamicInfo) {
      return;
    }

    const handleDimensionGroupChange = evt => {
      const { volumeId, dimensionGroupNumber, numDimensionGroups, splittingTag } = evt.detail;
      setDynamicInfo({ volumeId, dimensionGroupNumber, numDimensionGroups, label: splittingTag });
    };

    eventTarget.addEventListener(
      Enums.Events.DYNAMIC_VOLUME_DIMENSION_GROUP_CHANGED,
      handleDimensionGroupChange
    );

    return () => {
      eventTarget.removeEventListener(
        Enums.Events.DYNAMIC_VOLUME_DIMENSION_GROUP_CHANGED,
        handleDimensionGroupChange
      );
    };
  }, [dynamicInfo]);

  useEffect(() => {
    if (!dynamicInfo) {
      return;
    }

    const { volumeId, dimensionGroupNumber, numDimensionGroups, splittingTag } = dynamicInfo || {};
    const volume = cache.getVolume(volumeId, true);
    volume.dimensionGroupNumber = dimensionGroupNumber;

    setDynamicInfo({ volumeId, dimensionGroupNumber, numDimensionGroups, label: splittingTag });
  }, []);

  const updateDynamicInfo = useCallback(props => {
    const { volumeId, dimensionGroupNumber } = props;
    const volume = cache.getVolume(volumeId, true);
    volume.dimensionGroupNumber = dimensionGroupNumber;
  }, []);

  return (
    <CinePlayerComponent
      className="absolute left-1/2 bottom-8 -translate-x-1/2"
      frameRate={newStackFrameRate}
      isPlaying={isPlaying}
      onClose={() => {
        // also stop the clip
        cineService.setCine({
          id: viewportId,
          isPlaying: false,
        });
        cineService.setIsCineEnabled(false);
        cineService.setViewportCineClosed(viewportId);
      }}
      onPlayPauseChange={isPlaying => {
        cineService.setCine({
          id: viewportId,
          isPlaying,
        });
      }}
      onFrameRateChange={frameRate =>
        cineService.setCine({
          id: viewportId,
          frameRate,
        })
      }
      dynamicInfo={dynamicInfo}
      updateDynamicInfo={updateDynamicInfo}
    />
  );
}

export default WrappedCinePlayer;
