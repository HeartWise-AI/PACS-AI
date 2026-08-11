import { PROCESSING_NOTIFICATION_STUDY_PARAM } from '../../components/inference/processingNotificationNavigation';
import { getFiltersFromSearchParams } from './worklistSearchRestore';

describe('worklist URL search restoration', () => {
  it('uses the default date and does not search for unrelated URL parameters', () => {
    const restoredSearch = getFiltersFromSearchParams(
      new URLSearchParams('studyProcessingFixtures=true'),
      'ORTHANC-A',
      '20260811-20260811'
    );

    expect(restoredSearch.shouldSearch).toBe(false);
    expect(restoredSearch.filters).toEqual(
      expect.objectContaining({
        modalityId: 'ORTHANC-A',
        studyDate: '20260811-20260811',
      })
    );
  });

  it('restores the complete legacy Viewer or Segmentation search query', () => {
    const restoredSearch = getFiltersFromSearchParams(
      new URLSearchParams({
        patientName: 'DOE^JANE',
        patientId: '12345',
        studyDate: '20260801-20260811',
        studyDescription: 'CARDIAC',
        modalitiesInStudy: 'XA\\US',
        accessionNumber: 'ACC-1',
        modalityId: 'ORTHANC-B',
      }),
      'ORTHANC-A',
      '20260811-20260811'
    );

    expect(restoredSearch).toEqual(
      expect.objectContaining({
        shouldSearch: true,
        notificationStudyInstanceUID: null,
        filters: expect.objectContaining({
          patientName: 'DOE^JANE',
          patientId: '12345',
          studyDate: '20260801-20260811',
          studyDescription: 'CARDIAC',
          modalitiesInStudy: 'XA\\US',
          accessionNumber: 'ACC-1',
          modalityId: 'ORTHANC-B',
        }),
      })
    );
  });

  it('turns a processing notification deep link into a one-study search', () => {
    const searchParams = new URLSearchParams({
      [PROCESSING_NOTIFICATION_STUDY_PARAM]: 'study-from-notification',
    });

    const restoredSearch = getFiltersFromSearchParams(
      searchParams,
      'ORTHANC-A',
      '20260811-20260811'
    );

    expect(restoredSearch.shouldSearch).toBe(true);
    expect(restoredSearch.notificationStudyInstanceUID).toBe('study-from-notification');
    expect(restoredSearch.filters.studyInstanceUID).toBe('study-from-notification');
    expect(restoredSearch.filters.studyDate).toBe('');
  });
});
