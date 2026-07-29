/** @type {AppTypes.Config} */
window.config = {
  routerBasename: null,
  modes: [],
  extensions: [],
  showStudyList: true,
  strictZSpacingForVolumeViewport: true,
  showCPUFallbackMessage: true,
  defaultDataSourceName: 'dicomweb',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'DCM4CHEE Server',
        name: 'DCM4CHEE',
        wadoUriRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        wadoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        enableStudyLazyLoad: true,
        bulkDataURI: {
          enabled: false,
        },
        omitQuotationForMultipartRequest: true,
      },
    },
  ],
};
