import arabicAIModelButton from '@pacs-ai/extension-core/src/locales/ar/AIModelButton.json';
import germanAIModelButton from '@pacs-ai/extension-core/src/locales/de/AIModelButton.json';
import englishAIModelButton from '@pacs-ai/extension-core/src/locales/en-US/AIModelButton.json';
import spanishAIModelButton from '@pacs-ai/extension-core/src/locales/es/AIModelButton.json';
import frenchAIModelButton from '@pacs-ai/extension-core/src/locales/fr/AIModelButton.json';
import arabicStudyList from '@pacs-ai/extension-core/src/locales/ar/StudyList.json';
import germanStudyList from '@pacs-ai/extension-core/src/locales/de/StudyList.json';
import englishStudyList from '@pacs-ai/extension-core/src/locales/en-US/StudyList.json';
import spanishStudyList from '@pacs-ai/extension-core/src/locales/es/StudyList.json';
import frenchStudyList from '@pacs-ai/extension-core/src/locales/fr/StudyList.json';

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
