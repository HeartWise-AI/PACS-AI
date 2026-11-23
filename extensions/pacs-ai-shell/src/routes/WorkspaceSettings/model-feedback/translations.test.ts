import english from '@pacs-ai/extension-core/src/locales/en-US/ModelFeedback.json';
import french from '@pacs-ai/extension-core/src/locales/fr/ModelFeedback.json';
import englishCommon from '@pacs-ai/extension-core/src/locales/en-US/Common.json';
import frenchCommon from '@pacs-ai/extension-core/src/locales/fr/Common.json';
import locales from '@pacs-ai/extension-core/src/locales';

describe('Model feedback translations', () => {
  test('French has every English key, with non-empty values and the same placeholders', () => {
    expect(Object.keys(french).sort()).toEqual(Object.keys(english).sort());
    for (const [key, value] of Object.entries(english)) {
      const translated = (french as Record<string, string>)[key];
      expect(translated).toBeTruthy();
      const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
      expect(placeholders(translated)).toEqual(placeholders(value));
    }
  });

  test('keys avoid the i18next namespace separator', () => {
    expect(Object.keys(english).filter(key => key.includes(':'))).toEqual([]);
  });

  test('both locales register the namespace', () => {
    expect(locales['en-US'].ModelFeedback).toBe(english);
    expect(locales.fr.ModelFeedback).toBe(french);
  });

  test('the workspace settings tab label is translated', () => {
    expect((englishCommon as Record<string, string>)['Model Feedback']).toBe('Model Feedback');
    expect((frenchCommon as Record<string, string>)['Model Feedback']).toBeTruthy();
  });
});
