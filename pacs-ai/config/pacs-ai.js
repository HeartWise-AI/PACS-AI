/**
 * PACS-AI app config. Selected at build time with APP_CONFIG=config/pacs-ai.js;
 * the build copies it to app-config.js (pacs-ai/build/extend.js).
 *
 * Based on OHIF 3.13.14's locked-down platform/app/public/config/default.js
 * (P3.3). Every value that differs from that file is marked "PACS-AI:" with
 * the reason; the rest is upstream's. The data source reads its base URL from
 * window._env_ (env-config.js, generated at build time by
 * pacs-ai/build/generate-env-config.js).
 */
/** @type {AppTypes.Config} */

window.config = {
  // PACS-AI: our file name.
  name: 'config/pacs-ai.js',
  routerBasename: null,
  // whiteLabeling: {},
  extensions: [],
  // PACS-AI: the PACS-AI viewer mode (modes/pacs-ai) comes first: it serves
  // /viewer. The stock modes still listed in platform/app/pluginConfig.json
  // follow (segmentation, offered by the work list, and the other stock routes).
  modes: ['@pacs-ai/mode-viewer'],
  customizationService: {},

  // `?customization=` URL loading stays OFF, as in upstream's default:
  // no `customizationUrlPrefixes`.

  // Native ("next") Generic Viewport: off (decision D6), as upstream.
  genericViewports: {
    enabled: false,
  },
  // PACS-AI: OHIF's own study list stays off: the PACS-AI work list is served
  // at `/` by @pacs-ai/extension-shell (routes.customRoutes). With this on,
  // OHIF would register its list at `/` ahead of the custom routes.
  showStudyList: false,
  // some windows systems have issues with more than 3 web workers
  maxNumberOfWebWorkers: 3,
  // PACS-AI: off (decision D3; the data source is our same-origin API proxy).
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: true,
  // PACS-AI: off (decision D3).
  groupEnabledModesFirst: false,
  allowMultiSelectExport: false,
  // PACS-AI: cine starts by itself (US and XA autoplay, F15).
  autoPlayCine: true,
  // PACS-AI: runtime rollout controls for study processing. The values below
  // are the defaults in studyProcessing/featureFlags.ts; change them in the
  // deployed app-config.js without rebuilding the bundle.
  studyProcessing: {
    processingUIEnabled: true,
    restSnapshotsEnabled: true,
    runHistoryEnabled: true,
    realtimeSSEEnabled: true,
    studyEventNotificationsEnabled: true,
    manualReprocessingEnabled: true,
    candidatePollingEnabled: true,
    fixturePreviewEnabled: false,
  },
  maxNumRequests: {
    interaction: 100,
    // PACS-AI: 75 (upstream lowered its default to 5 in 3.13). Our study
    // browser renders every thumbnail with WADO-RS through the API proxy
    // (thumbnailRendering 'wadors') and cardiac studies have up to ~50
    // series. P3.5 measured 5 against 75 on the server (p34-46596c475,
    // median of 3): all 22 thumbnails of an XA study 9.7 s vs 8.4 s,
    // all 24 of an echo study 11.1 s vs 7.3 s; first image not faster. Kept at 75.
    thumbnail: 75,
    // Prefetch number is dependent on the http protocol. For http 2 or
    // above, the number of requests can be go a lot higher.
    prefetch: 25,
  },
  showErrorDetails: 'always', // 'always', 'dev', 'production'
  // `dangerouslyUseDynamicConfig` stays OFF, as in upstream's default.
  // No `multimonitor` layouts, as in upstream's default (3.11.1's default,
  // which this file was copied from, had two; PACS-AI never used them).
  // PACS-AI: our data source.
  defaultDataSourceName: 'dicomweb',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      // PACS-AI: our data source name (upstream's is 'ohif').
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'AWS S3 Static wado server',
        name: 'aws',
        // PACS-AI: Orthanc behind the authenticated API proxy.
        wadoUriRoot: window._env_.APP_PUBLIC_API_URL + '/proxy/orthanc/dicom-web',
        qidoRoot: window._env_.APP_PUBLIC_API_URL + '/proxy/orthanc/dicom-web',
        wadoRoot: window._env_.APP_PUBLIC_API_URL + '/proxy/orthanc/dicom-web',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        // PACS-AI: thumbnails rendered from the image (WADO-RS) as on 3.11.1;
        // upstream asks the server's /thumbnail with fetch. Not changed until
        // the proxy's rendered thumbnails are checked (P3.5).
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        // PACS-AI: Orthanc's QIDO matching (fuzzy on, wildcard off), as on 3.11.1.
        supportsFuzzyMatching: true,
        supportsWildcard: false,
        staticWado: true,
        singlepart: 'bulkdata,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
          transform: url => url.replace('/pixeldata.mp4', '/rendered'),
        },
        omitQuotationForMultipartRequest: true,
        // No `queryLimit`: it limits OHIF's own study list
        // (useStudyListQuery), which PACS-AI does not use; our work list
        // queries the PACS-AI API.
      },
    },
    // The data sources 3.11.1's default listed besides this one (ohif2,
    // ohif3, local5000, orthanc, dicomwebproxy, dicomjson, dicomlocal) are
    // not enabled, as in upstream's default: nothing in PACS-AI selects them,
    // and dicomjson/dicomwebproxy/dicomlocal load data from `?url=` or local
    // files.
  ],
  httpErrorHandler: error => {
    // This is 429 when rejected from the public idc sandbox too often.
    console.warn(error.status);

    // Could use services manager here to bring up a dialog/modal if needed.
    console.warn('test, navigate to https://ohif.org/');
  },
};
