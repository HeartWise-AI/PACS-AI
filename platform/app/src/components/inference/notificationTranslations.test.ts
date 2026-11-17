import englishStudyList from '../../../../i18n/src/locales/en-US/StudyList.json';
import frenchStudyList from '@pacs-ai/extension-core/src/locales/fr/StudyList.json';
import testStudyList from '../../../../i18n/src/locales/test-LNG/StudyList.json';

const notificationKeys = Object.keys(englishStudyList).filter(key =>
  key.startsWith('ProcessingNotification')
);

describe('processing notification translations', () => {
  test.each([
    ['English', englishStudyList],
    ['French', frenchStudyList],
    ['Test', testStudyList],
  ])('%s defines every notification string', (_language, studyList) => {
    expect(notificationKeys).toEqual(
      expect.arrayContaining([
        'ProcessingNotificationAccession',
        'ProcessingNotificationStudyReference',
      ])
    );
    notificationKeys.forEach(key => {
      expect(studyList[key as keyof typeof studyList]).toBeTruthy();
    });
  });

  test.each([
    ['English', englishStudyList],
    ['French', frenchStudyList],
    ['Test', testStudyList],
  ])('%s keeps the placeholders of the study references', (_language, studyList) => {
    expect(studyList.ProcessingNotificationAccession).toContain('{{accession}}');
    expect(studyList.ProcessingNotificationStudyReference).toContain('{{suffix}}');
  });
});
