import i18n from '@ohif/i18n';
import locales from './index';

/** @ohif/i18n adds addLocales to its i18next instance; its types do not say so. */
type OhifI18n = { addLocales: (newLocales: typeof locales) => void };

/**
 * Adds our translations to OHIF's i18next instance. OHIF loads its own
 * locales when @ohif/i18n is imported, so this runs after them: keys in files
 * named after an OHIF namespace are merged over OHIF's (deep, overwrite).
 */
export default function registerLocales(): void {
  (i18n as unknown as OhifI18n).addLocales(locales);
}
