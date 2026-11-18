import { useCallback } from 'react';
import { useSystem } from '@ohif/core';
import {
  getStudiesForPatientByMRN,
  requestDisplaySetCreationForStudy,
} from '@ohif/extension-default';

/**
 * Renders an image to a canvas and returns it as a data URL (OHIF v3.13.14
 * extensions/default/src/Panels/getImageSrcFromImageId.js, not exported).
 */
function getImageSrcFromImageId(cornerstone, imageId) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    cornerstone.utilities
      .loadImageToCanvas({ canvas, imageId, thumbnail: true })
      .then(() => {
        resolve(canvas.toDataURL());
      })
      .catch(reject);
  });
}

function createGetImageSrcFromImageIdFn(extensionManager) {
  const utilities = extensionManager.getModuleEntry(
    '@ohif/extension-cornerstone.utilityModule.common'
  );

  try {
    const { cornerstone } = utilities.exports.getCornerstoneLibraries();
    return getImageSrcFromImageId.bind(null, cornerstone);
  } catch (ex) {
    throw new Error('Required command not found');
  }
}

/**
 * The props OHIF's panel wrappers (WrappedPanelStudyBrowser and
 * WrappedPanelStudyBrowserTracking in v3.13.14) give the study browser panel:
 * the active data source and the functions bound to it.
 */
export function usePanelStudyBrowserProps() {
  const { extensionManager } = useSystem();
  const [dataSource] = extensionManager.getActiveDataSource();
  const _getStudiesForPatientByMRN = getStudiesForPatientByMRN.bind(null, dataSource);
  // Created once per mount, as upstream does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const _getImageSrcFromImageId = useCallback(createGetImageSrcFromImageIdFn(extensionManager), []);
  const _requestDisplaySetCreationForStudy = requestDisplaySetCreationForStudy.bind(
    null,
    dataSource
  );

  return {
    dataSource,
    getImageSrc: _getImageSrcFromImageId,
    getStudiesForPatientByMRN: _getStudiesForPatientByMRN,
    requestDisplaySetCreationForStudy: _requestDisplaySetCreationForStudy,
  };
}
