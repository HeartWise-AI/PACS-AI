import english from '@pacs-ai/extension-core/src/locales/en-US/ChatFeedback.json';
import french from '@pacs-ai/extension-core/src/locales/fr/ChatFeedback.json';
import englishChat from '@pacs-ai/extension-core/src/locales/en-US/ChatBox.json';
import frenchChat from '@pacs-ai/extension-core/src/locales/fr/ChatBox.json';
import englishCommon from '@pacs-ai/extension-core/src/locales/en-US/Common.json';
import frenchCommon from '@pacs-ai/extension-core/src/locales/fr/Common.json';
import locales from '@pacs-ai/extension-core/src/locales';
import { CHAT_FEEDBACK_CATEGORIES } from '@pacs-ai/extension-core/src/api/orchestratorDTO';

const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();

describe('Chat feedback translations', () => {
  test('French has every English key with the same placeholders', () => {
    expect(Object.keys(french).sort()).toEqual(Object.keys(english).sort());
    for (const [key, value] of Object.entries(english)) {
      const translated = (french as Record<string, string>)[key];
      expect(translated).toBeTruthy();
      expect(placeholders(translated)).toEqual(placeholders(value));
    }
  });

  test('both locales register the namespace and the tab label', () => {
    expect(locales['en-US'].ChatFeedback).toBe(english);
    expect(locales.fr.ChatFeedback).toBe(french);
    expect((englishCommon as Record<string, string>)['Chat Feedback']).toBe('Chat Feedback');
    expect((frenchCommon as Record<string, string>)['Chat Feedback']).toBeTruthy();
  });

  test('every reason the chat backend accepts has a label in both languages', () => {
    const reasons = [...CHAT_FEEDBACK_CATEGORIES.up, ...CHAT_FEEDBACK_CATEGORIES.down];
    for (const reason of reasons) {
      expect((englishChat as Record<string, string>)[`FeedbackReason_${reason}`]).toBeTruthy();
      expect((frenchChat as Record<string, string>)[`FeedbackReason_${reason}`]).toBeTruthy();
    }
  });
});
