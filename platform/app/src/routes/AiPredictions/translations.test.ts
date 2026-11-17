import english from '@pacs-ai/extension-core/src/locales/en-US/AiPredictions.json';
import french from '@pacs-ai/extension-core/src/locales/fr/AiPredictions.json';
import englishIndex from '../../../../i18n/src/locales/en-US/index.js';
import frenchIndex from '../../../../i18n/src/locales/fr/index.js';

describe('AI Predictions translations', () => {
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
    expect(englishIndex['en-US'].AiPredictions).toBe(english);
    expect(frenchIndex.fr.AiPredictions).toBe(french);
  });
});
