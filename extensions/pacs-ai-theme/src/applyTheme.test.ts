import { readFileSync } from 'fs';
import { resolve } from 'path';
import extension, {
  applyPacsAiTheme,
  isPacsAiThemeConfigured,
  PACS_AI_THEME_CLASS,
  PACS_AI_THEME_CUSTOMIZATION,
  pacsAiTheme,
} from './index';

const root = resolve(__dirname, '../../..');

function loadAppConfig() {
  const source = readFileSync(resolve(root, 'pacs-ai/config/pacs-ai.js'), 'utf8');
  const window: { config?: Record<string, unknown>; _env_?: Record<string, string> } = {
    _env_: {},
  };
  new Function('window', source)(window);
  return window.config;
}

describe('PACS-AI theme activation', () => {
  afterEach(() => {
    document.body.className = '';
  });

  test('preRegistration puts the theme class on the body when configured', () => {
    extension.preRegistration({
      appConfig: { customizationService: [PACS_AI_THEME_CUSTOMIZATION] },
    });
    expect(document.body.classList.contains(PACS_AI_THEME_CLASS)).toBe(true);
  });

  test('preRegistration does nothing when the app config does not list the theme', () => {
    extension.preRegistration({ appConfig: { customizationService: {} } });
    extension.preRegistration({});
    expect(document.body.classList.contains(PACS_AI_THEME_CLASS)).toBe(false);
  });

  test('the phased customization form counts as well', () => {
    expect(
      isPacsAiThemeConfigured({ customizationService: { global: [PACS_AI_THEME_CUSTOMIZATION] } })
    ).toBe(true);
  });

  test('applyPacsAiTheme is idempotent', () => {
    applyPacsAiTheme();
    applyPacsAiTheme();
    expect(document.body.className).toBe(PACS_AI_THEME_CLASS);
  });

  test('the reference does not trigger upstream theme provider (decision D5)', () => {
    // @ohif/extension-default init mounts ActiveThemeProvider (Appearance
    // dialog, ?theme=) for any reference containing this text.
    expect(PACS_AI_THEME_CUSTOMIZATION).not.toContain('customizationModule.theme');
  });

  test('the customization module exposes the preset under the referenced name', () => {
    const [module] = extension.getCustomizationModule();
    expect(PACS_AI_THEME_CUSTOMIZATION).toBe(`${extension.id}.customizationModule.${module.name}`);
    expect(module.value['pacsAi.theme']).toBe(pacsAiTheme);
  });

  test('pacs-ai.js makes the PACS-AI theme the default and keeps upstream theme module out', () => {
    const config = loadAppConfig();
    expect(isPacsAiThemeConfigured(config)).toBe(true);
    expect(JSON.stringify(config.customizationService)).not.toContain(
      'extension-default.customizationModule.theme'
    );
  });
});
