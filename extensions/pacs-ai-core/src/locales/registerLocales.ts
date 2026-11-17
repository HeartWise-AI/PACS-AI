import i18n from '@ohif/i18n';
import locales from './index';

/**
 * Adds our translations to OHIF's i18next instance. OHIF loads its own
 * locales when @ohif/i18n is imported, so this runs after them: keys in files
 * named after an OHIF namespace are merged over OHIF's (deep, overwrite).
 */
export default function registerLocales(): void {
  i18n.addLocales(locales);
}
