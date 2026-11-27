import {
  installViewerStudyRequestTracking,
  markViewerStudyRetrieved,
  recordViewerStudyRequest,
  stripPatientIdentifiersFromAddressBar,
  studyInstanceUIDFromSearch,
  studyOpenPath,
  takeViewerStudyToRetrieve,
  toStudyOpenPath,
  VIEWER_REQUEST_MAX_AGE_MS,
  VIEWER_REQUEST_STORAGE_KEY,
  VIEWER_RETRIEVE_RETRY_WINDOW_MS,
  viewerPathForStudy,
  viewerSearchForStudy,
  withoutPatientIdentifiers,
} from './viewerUrl';

describe('viewer URLs without patient identifiers', () => {
  it('opens a study with its UID and non-identifying filters only', () => {
    const search = viewerSearchForStudy('1.2.3', {
      modalityId: 'MHI_PACS',
      patientId: 'MRN001*',
      patientName: 'DOE^JANE',
      patientBirthDate: '19700101',
      accessionNumber: 'ACC1',
      modalitiesInStudy: 'XA',
      studyDate: '20261127-20261127',
      studyDescription: 'CORO',
    });
    expect(search).toBe('StudyInstanceUIDs=1.2.3&modalitiesInStudy=XA&studyDate=20261127-20261127');
    expect(search).not.toMatch(/patient|MRN001|DOE|ACC1/i);
  });

  it('drops identifying parameters whatever their case and keeps the rest', () => {
    expect(
      withoutPatientIdentifiers(
        '?StudyInstanceUIDs=1.2.3&PatientID=MRN001&patientName=X&mrn=7&modalitiesInStudy=XA&SeriesInstanceUIDs=4.5'
      ).toString()
    ).toBe('StudyInstanceUIDs=1.2.3&modalitiesInStudy=XA&SeriesInstanceUIDs=4.5');
  });

  it('cleans the address bar of an old deep link without navigating', () => {
    window.history.replaceState({ idx: 3 }, '', '/viewer?StudyInstanceUIDs=1.2.3&patientId=MRN001&studyDate=20261127#x');
    expect(stripPatientIdentifiersFromAddressBar()).toBe(true);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/viewer?StudyInstanceUIDs=1.2.3&studyDate=20261127#x'
    );
    expect(window.history.state).toEqual({ idx: 3 });
    expect(stripPatientIdentifiersFromAddressBar()).toBe(false);
  });

  it('leaves a clean URL untouched (no re-encoding)', () => {
    window.history.replaceState(null, '', '/viewer?StudyInstanceUIDs=1.2.3,4.5.6');
    expect(stripPatientIdentifiersFromAddressBar()).toBe(false);
    expect(window.location.search).toBe('?StudyInstanceUIDs=1.2.3,4.5.6');
  });
});

describe('the shared "open this study" link', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  };

  it('goes through /open-study with the study UID and non-identifying filters only', () => {
    expect(studyOpenPath('1.2.3')).toBe('/open-study?StudyInstanceUIDs=1.2.3');
    const path = studyOpenPath(' 1.2.3 ', {
      patientId: 'MRN001',
      patientName: 'DOE^JANE',
      modalitiesInStudy: 'XA',
      studyDate: '20261127',
    });
    expect(path).toBe('/open-study?StudyInstanceUIDs=1.2.3&modalitiesInStudy=XA&studyDate=20261127');
    expect(path).not.toMatch(/MRN001|DOE|patient/i);
  });

  it('builds the viewer page with the same parameters', () => {
    expect(viewerPathForStudy('1.2.3', { modalitiesInStudy: 'US', patientId: 'X' })).toBe(
      '/viewer?StudyInstanceUIDs=1.2.3&modalitiesInStudy=US'
    );
  });

  it('reads the first study UID of a query string and rejects anything else', () => {
    expect(studyInstanceUIDFromSearch('?StudyInstanceUIDs=1.2.3,4.5.6')).toBe('1.2.3');
    expect(studyInstanceUIDFromSearch('studyInstanceUIDs=7.8')).toBe('7.8');
    expect(studyInstanceUIDFromSearch('StudyInstanceUIDs=1.2%26x%3D3')).toBeNull();
    expect(studyInstanceUIDFromSearch('patientId=1')).toBeNull();
  });

  it('turns a handoff /viewer return path into the open-study link, without patient keys', () => {
    expect(toStudyOpenPath('/viewer?StudyInstanceUIDs=1.2.3&patientId=MRN1&modalitiesInStudy=XA')).toBe(
      '/open-study?StudyInstanceUIDs=1.2.3&modalitiesInStudy=XA'
    );
    expect(toStudyOpenPath('/viewer?foo=1')).toBe('/viewer?foo=1');
    expect(toStudyOpenPath('/ai-predictions')).toBe('/ai-predictions');
    expect(toStudyOpenPath('/')).toBe('/');
  });

  it('lets the not-found page retry a recent /viewer request once, then never again', () => {
    const storage = memory();
    let t = 1_000_000;
    const now = () => t;
    recordViewerStudyRequest('/ai-predictions', '?StudyInstanceUIDs=9.9', { storage, now });
    expect(takeViewerStudyToRetrieve({ storage, now })).toBeNull();

    recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.2.3', { storage, now });
    t += 5_000;
    expect(takeViewerStudyToRetrieve({ storage, now })).toBe('1.2.3');
    // The open flow sent the viewer back to the same study and it is still missing.
    recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.2.3', { storage, now });
    expect(takeViewerStudyToRetrieve({ storage, now })).toBeNull();
    // Much later the study may be retrieved again.
    t += VIEWER_RETRIEVE_RETRY_WINDOW_MS + 1;
    recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.2.3', { storage, now });
    expect(takeViewerStudyToRetrieve({ storage, now })).toBe('1.2.3');
  });

  it('ignores a stale request and a study /open-study just retrieved', () => {
    const storage = memory();
    let t = 5_000_000;
    const now = () => t;
    recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=1.2.3', { storage, now });
    t += VIEWER_REQUEST_MAX_AGE_MS + 1;
    expect(takeViewerStudyToRetrieve({ storage, now })).toBeNull();

    markViewerStudyRetrieved('4.5.6', { storage, now });
    recordViewerStudyRequest('/viewer', '?StudyInstanceUIDs=4.5.6', { storage, now });
    expect(takeViewerStudyToRetrieve({ storage, now })).toBeNull();
  });

  it('records /viewer requests made through history navigation', () => {
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/');
    installViewerStudyRequestTracking();
    window.history.pushState({}, '', '/viewer?StudyInstanceUIDs=1.2.840.99');
    expect(JSON.parse(window.sessionStorage.getItem(VIEWER_REQUEST_STORAGE_KEY) || '{}').uid).toBe(
      '1.2.840.99'
    );
    window.history.pushState({}, '', '/');
  });
});
