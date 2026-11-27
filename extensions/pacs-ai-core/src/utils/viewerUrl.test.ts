import {
  stripPatientIdentifiersFromAddressBar,
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
