import englishStudyList from '../../../../../i18n/src/locales/en-US/StudyList.json';
import frenchStudyList from '../../../../../i18n/src/locales/fr/StudyList.json';
import testStudyList from '../../../../../i18n/src/locales/test-LNG/StudyList.json';

const readableKeys = Object.keys(englishStudyList).filter(key =>
  key.startsWith('ProcessingReadableResult')
);

describe('readable result translations', () => {
  test.each([
    ['English', englishStudyList],
    ['French', frenchStudyList],
    ['Test', testStudyList],
  ])('%s defines every readable result string', (_language, studyList) => {
    expect(readableKeys).toHaveLength(12);
    readableKeys.forEach(key => {
      expect(studyList[key as keyof typeof studyList]).toBeTruthy();
    });
    expect(studyList.ProcessingReadableResultOmitted).toContain('{{fields}}');
  });
});
