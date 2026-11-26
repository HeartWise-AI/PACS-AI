// App-wide language: the top-bar selector sets the UI language (OHIF i18n) and
// the default language of chat answers. Until the user picks one, the app starts
// on the chat backend's default (CHAT_DEFAULT_LANGUAGE: fr at hospitals, en on
// the public deployment). A question written in another language, or one that
// asks for a language, is still answered in that language by the backend.
// The i18next singleton that @ohif/i18n configures (same package version).
import i18n from 'i18next';
import orchestratorRepository from '../api/orchestratorRepository';

export type ChatLanguage = 'en' | 'fr';

/** Set only when the user picks a language (i18next caches detected ones too). */
export const CHOSEN_LANGUAGE_KEY = 'pacsAiLanguageChosen';

let siteDefault: ChatLanguage | null = null;
let siteDefaultRequest: Promise<ChatLanguage | null> | null = null;

function readChosen(): string | null {
  try {
    return window.localStorage.getItem(CHOSEN_LANGUAGE_KEY);
  } catch {
    return null;
  }
}

/** i18next code for a language key of the selector ('fr', 'en', 'es', ...). */
export function i18nLanguageCode(language: string): string {
  const base = language.toLowerCase().split(/[-_]/)[0];
  return base === 'en' ? 'en-US' : base;
}

/** The chat language for a UI language: French for French, English otherwise. */
export function chatLanguageFor(language: string | null | undefined): ChatLanguage {
  return String(language || '')
    .toLowerCase()
    .startsWith('fr')
    ? 'fr'
    : 'en';
}

/** The language the user picked in the top bar, if any. */
export function chosenLanguage(): string | null {
  return readChosen();
}

/** The user picks a language: switch the UI and remember the choice in this browser. */
export function chooseLanguage(language: string): void {
  const code = i18nLanguageCode(language);
  try {
    window.localStorage.setItem(CHOSEN_LANGUAGE_KEY, code);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  i18n.changeLanguage(code);
}

/**
 * Start on the chat backend's default language when the user has chosen none.
 * Asked once per page; a failure leaves the browser's language and the chat
 * sends no language (the backend then uses its default).
 */
export function applySiteDefaultLanguage(
  fetchSettings: () => Promise<{ data?: { chat_default_language?: string | null } }> = () =>
    orchestratorRepository.GetChatSettings()
): Promise<ChatLanguage | null> {
  if (!siteDefaultRequest) {
    siteDefaultRequest = fetchSettings()
      .then(response => {
        const language = response?.data?.chat_default_language;
        if (language !== 'fr' && language !== 'en') {
          return null;
        }
        siteDefault = language;
        if (!readChosen() && chatLanguageFor(i18n.language) !== language) {
          i18n.changeLanguage(i18nLanguageCode(language));
        }
        return language;
      })
      .catch(() => {
        siteDefaultRequest = null;
        return null;
      });
  }
  return siteDefaultRequest;
}

/**
 * The app language to send with a chat message: the user's choice, else the
 * site default once known (the UI shows it), else nothing.
 */
export function chatResponseLanguage(): ChatLanguage | undefined {
  const chosen = readChosen();
  if (chosen) {
    return chatLanguageFor(chosen);
  }
  return siteDefault ? chatLanguageFor(i18n.language) : undefined;
}

/** Tests only. */
export function resetAppLanguageForTests(): void {
  siteDefault = null;
  siteDefaultRequest = null;
}
