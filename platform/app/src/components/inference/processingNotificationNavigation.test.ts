import {
  buildProcessingNotificationWorklistPath,
  findProcessingNotificationStudyPage,
  PROCESSING_NOTIFICATION_STUDY_PARAM,
} from './processingNotificationNavigation';

describe('processing notification navigation', () => {
  it('encodes the Study Instance UID as a worklist deep link', () => {
    const path = buildProcessingNotificationWorklistPath('1.2.840/example value');
    const searchParams = new URLSearchParams(path.split('?')[1]);

    expect(path.startsWith('/?')).toBe(true);
    expect(searchParams.get(PROCESSING_NOTIFICATION_STUDY_PARAM)).toBe('1.2.840/example value');
  });

  it('returns the page containing the exact study without page-local indexing', () => {
    expect(
      findProcessingNotificationStudyPage(
        ['study-1', 'study-2', 'study-3', 'study-4'],
        'study-3',
        2
      )
    ).toBe(2);
  });

  it('returns no page when the study is unavailable', () => {
    expect(findProcessingNotificationStudyPage(['study-1'], 'missing-study', 10)).toBeNull();
  });
});
