import { id } from './id';
import './styles/pacs-ai-theme.css';
import { applyPacsAiTheme, isPacsAiThemeConfigured } from './applyTheme';
import getCustomizationModule from './getCustomizationModule';

export { colors, primaryGradient } from './tokens';
export { pacsAiLogo, pacsAiLogoVertical, pacsAiIconLogo } from './logos';
export { pacsAiTheme, PACS_AI_THEME_CLASS, PACS_AI_THEME_NAME } from './theme/pacsAiTheme';
export type { PacsAiThemePreset } from './theme/pacsAiTheme';
export {
  applyPacsAiTheme,
  isPacsAiThemeConfigured,
  PACS_AI_THEME_CUSTOMIZATION,
} from './applyTheme';

/**
 * Registered in platform/app/pluginConfig.json. Copies `public/` (favicons)
 * into the build, ships the PACS-AI theme (src/styles/pacs-ai-theme.css) and
 * turns it on before the app renders when pacs-ai.js lists
 * `@pacs-ai/theme.customizationModule.pacsAiTheme`.
 */
const pacsAiThemeExtension = {
  id,
  preRegistration({ appConfig }: { appConfig?: { customizationService?: unknown } } = {}) {
    if (isPacsAiThemeConfigured(appConfig)) {
      applyPacsAiTheme();
    }
  },
  getCustomizationModule,
};

export default pacsAiThemeExtension;
