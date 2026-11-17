// Test double for react-i18next's useTranslation('ChatBox'), backed by the real
// locale files so tests assert the strings users actually see.
const LOCALES: Record<string, Record<string, string>> = {
  'en-US': require('@ohif/i18n/src/locales/en-US/ChatBox.json'),
  fr: require('@ohif/i18n/src/locales/fr/ChatBox.json'),
  de: require('@ohif/i18n/src/locales/de/ChatBox.json'),
  es: require('@ohif/i18n/src/locales/es/ChatBox.json'),
  ar: require('@ohif/i18n/src/locales/ar/ChatBox.json'),
};

let activeLocale = 'en-US';

export const chatBoxLocales = LOCALES;

export function setTestLocale(locale: string) {
  activeLocale = locale;
}

export function translate(key: string, options: Record<string, any> = {}): string {
  const template = LOCALES[activeLocale]?.[key] ?? options.defaultValue ?? key;
  return String(template).replace(/{{\s*(\w+)\s*}}/g, (_match, name) =>
    options[name] === undefined || options[name] === null ? '' : String(options[name])
  );
}

export function useTranslationMock() {
  return { t: translate };
}
