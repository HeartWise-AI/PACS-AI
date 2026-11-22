import { PACS_AI_THEME_CLASS } from './theme/pacsAiTheme';

/**
 * The app-config reference that turns the PACS-AI theme on, in
 * `customizationService` of pacs-ai/config/pacs-ai.js. It mirrors upstream's
 * opt-in `@ohif/extension-default.customizationModule.theme` (which also
 * mounts OHIF's Appearance dialog, kept off by decision D5). The name must not
 * contain `customizationModule.theme`: @ohif/extension-default's init looks
 * for that substring to mount its theme provider.
 */
export const PACS_AI_THEME_CUSTOMIZATION = '@pacs-ai/theme.customizationModule.pacsAiTheme';

type CustomizationConfig = unknown;

function references(config: CustomizationConfig): unknown[] {
  if (Array.isArray(config)) {
    return config;
  }
  if (config && typeof config === 'object') {
    // Phased form ({ requires, bootstrap, global, mode }): any phase counts.
    return Object.values(config as Record<string, unknown>).flatMap(value =>
      Array.isArray(value) ? value : [value]
    );
  }
  return [];
}

/** True when the app config lists the PACS-AI theme customization. */
export function isPacsAiThemeConfigured(appConfig?: {
  customizationService?: CustomizationConfig;
}): boolean {
  return references(appConfig?.customizationService).some(
    ref => ref === PACS_AI_THEME_CUSTOMIZATION
  );
}

/**
 * Puts the theme class on `document.body` (as upstream's ActiveThemeProvider
 * does for its presets); pacs-ai-theme.css scopes the tokens and chrome to it.
 */
export function applyPacsAiTheme(doc: Document = document): void {
  doc.body.classList.add(PACS_AI_THEME_CLASS);
}
