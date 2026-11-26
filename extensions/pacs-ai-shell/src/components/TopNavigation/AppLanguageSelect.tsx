import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
// The i18next singleton that @ohif/i18n configures (same package version).
import i18n from 'i18next';
import { Languages } from '@pacs-ai/extension-core/src/api/dto';
import {
  applySiteDefaultLanguage,
  chooseLanguage,
} from '@pacs-ai/extension-core/src/service/appLanguage';

const LANGUAGE_KEYS = Object.keys(Languages);

function selectorKey(language: string | undefined): string {
  const key = String(language || '')
    .split(/[-_]/)[0]
    .toUpperCase();
  return LANGUAGE_KEYS.includes(key) ? key : 'EN';
}

/**
 * App-wide language in the top bar: the UI language and the default language of
 * chat answers. Starts on the site's default until the user picks one.
 */
export function AppLanguageSelect() {
  const { t } = useTranslation('TopNavigation');
  const [language, setLanguage] = useState(() => selectorKey(i18n.language));

  useEffect(() => {
    const update = (next: string) => setLanguage(selectorKey(next));
    i18n.on('languageChanged', update);
    applySiteDefaultLanguage();
    return () => i18n.off('languageChanged', update);
  }, []);

  return (
    <label
      className="flex items-center"
      title={t('App language help')}
    >
      <span className="sr-only">{t('App language')}</span>
      <select
        data-testid="app-language"
        aria-label={t('App language')}
        value={language}
        onChange={event => chooseLanguage(event.target.value.toLowerCase())}
        className="min-h-9 focus-visible:ring-primary cursor-pointer appearance-none rounded-lg border border-white/20 bg-transparent px-2 text-xs font-semibold uppercase text-white outline-none hover:bg-white/10 focus-visible:ring-2"
      >
        {LANGUAGE_KEYS.map(key => (
          <option
            key={key}
            value={key}
            className="!bg-[#323631] normal-case"
          >
            {key}
          </option>
        ))}
      </select>
    </label>
  );
}

export default AppLanguageSelect;
