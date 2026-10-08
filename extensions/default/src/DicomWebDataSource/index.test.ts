import { api } from 'dicomweb-client';
import { createDicomWebApi } from './index';

jest.mock('dicomweb-client', () => ({
  api: {
    DICOMwebClient: jest.fn().mockImplementation(config => ({
      config,
      headers: config.headers,
    })),
  },
}));

jest.mock('./qido.js', () => ({
  mapParams: jest.fn(params => params),
  search: jest.fn(),
  seriesInStudy: jest.fn(),
  processResults: jest.fn(),
  processSeriesResults: jest.fn(),
}));

jest.mock('./retrieveStudyMetadata.js', () => ({
  retrieveStudyMetadata: jest.fn(),
  deleteStudyMetadataPromise: jest.fn(),
}));

jest.mock('./dcm4cheeReject.js', () => jest.fn());
jest.mock('./utils/getImageId.js', () => jest.fn());
jest.mock('./utils/StaticWadoClient', () => jest.fn());
jest.mock('../utils/getDirectURL', () => jest.fn());
jest.mock('./utils/fixBulkDataURI', () => ({ fixBulkDataURI: jest.fn() }));

jest.mock('@ohif/core', () => ({
  DicomMetadataStore: {
    addInstances: jest.fn(),
    addSeriesMetadata: jest.fn(),
  },
  IWebApiDataSource: {
    create: implementation => implementation,
  },
  utils: {
    generateAcceptHeader: jest.fn(() => 'multipart/related; type="application/octet-stream"'),
    splitComma: jest.fn(values => values),
  },
  errorHandler: {
    getHTTPErrorHandler: jest.fn(),
  },
  classes: {
    MetadataProvider: {},
  },
}));

const DICOMwebClient = api.DICOMwebClient as jest.Mock;

function initializeDataSource(authenticationHeader = { Authorization: 'Bearer ohif-token' }) {
  const dataSource = createDicomWebApi(
    {
      name: 'test',
      qidoRoot: 'https://example.test/qido',
      wadoRoot: 'https://example.test/wado',
    },
    {
      services: {
        userAuthenticationService: {
          getAuthorizationHeader: jest.fn(() => authenticationHeader),
        },
      },
    }
  );

  dataSource.initialize({ params: {}, query: new URLSearchParams() });
  return dataSource;
}

describe('DICOMweb PACS-AI authentication contract', () => {
  beforeEach(() => {
    localStorage.clear();
    DICOMwebClient.mockClear();
  });

  it('uses the PACS session token for both QIDO and WADO clients', () => {
    localStorage.setItem('sessionToken', 'pacs-session-token');

    initializeDataSource();

    expect(DICOMwebClient).toHaveBeenCalledTimes(2);
    expect(DICOMwebClient.mock.calls[0][0].headers).toEqual({
      Authorization: 'Bearer pacs-session-token',
    });
    expect(DICOMwebClient.mock.calls[1][0].headers).toEqual({
      Authorization: 'Bearer pacs-session-token',
    });
  });

  it('falls back to the OHIF authentication service when no PACS session token exists', () => {
    initializeDataSource({ Authorization: 'Bearer ohif-token' });

    expect(DICOMwebClient).toHaveBeenCalledTimes(2);
    expect(DICOMwebClient.mock.calls[0][0].headers).toEqual({
      Authorization: 'Bearer ohif-token',
    });
    expect(DICOMwebClient.mock.calls[1][0].headers).toEqual({
      Authorization: 'Bearer ohif-token',
    });
  });
});
