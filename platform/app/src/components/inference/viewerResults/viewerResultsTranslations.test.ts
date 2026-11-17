import arabicAIModelButton from '../../../../../i18n/src/locales/ar/AIModelButton.json';
import germanAIModelButton from '../../../../../i18n/src/locales/de/AIModelButton.json';
import englishAIModelButton from '../../../../../i18n/src/locales/en-US/AIModelButton.json';
import spanishAIModelButton from '../../../../../i18n/src/locales/es/AIModelButton.json';
import frenchAIModelButton from '../../../../../i18n/src/locales/fr/AIModelButton.json';
import arabicStudyList from '../../../../../i18n/src/locales/ar/StudyList.json';
import germanStudyList from '../../../../../i18n/src/locales/de/StudyList.json';
import englishStudyList from '../../../../../i18n/src/locales/en-US/StudyList.json';
import spanishStudyList from '../../../../../i18n/src/locales/es/StudyList.json';
import frenchStudyList from '../../../../../i18n/src/locales/fr/StudyList.json';

const viewerKeys = Object.keys(englishAIModelButton).filter(key => key.startsWith('Viewer'));

describe('viewer previous-result translations', () => {
  test.each([
    ['Arabic', arabicAIModelButton, arabicStudyList],
    ['German', germanAIModelButton, germanStudyList],
    ['English', englishAIModelButton, englishStudyList],
    ['Spanish', spanishAIModelButton, spanishStudyList],
    ['French', frenchAIModelButton, frenchStudyList],
  ])('%s defines every viewer result string', (_language, aiModelButton, studyList) => {
    expect(viewerKeys.length).toBeGreaterThan(0);
    viewerKeys.forEach(key => {
      expect(aiModelButton[key as keyof typeof aiModelButton]).toBeTruthy();
    });
    expect(studyList['ProcessingViewerRun' as keyof typeof studyList]).toBeTruthy();
  });
});
