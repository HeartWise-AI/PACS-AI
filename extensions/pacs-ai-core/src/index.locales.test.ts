/**
 * OHIF imports every extension before registering any, then registers them
 * in pluginConfig order; default and measurement-tracking (listed before us)
 * compute their side-panel labels with i18n.t while registering. Our
 * translations must therefore be in i18n once this module is imported.
 */
// @ohif/i18n's package main is its unbuilt UMD bundle; use the real source.
jest.mock('@ohif/i18n', () => jest.requireActual('@ohif/i18n/src/index.js'), { virtual: true });
jest.mock('./providers/PacsAiAppProviders', () => ({ __esModule: true, default: () => null }));

describe('@pacs-ai/extension-core locales', () => {
  test('a registration-time i18n.t sees our translations after import alone', async () => {
    const i18n = require('@ohif/i18n').default;
    await i18n.initializing;
    // Upstream de has no SidePanel namespace (since OHIF 3.13 upstream fr
    // translates these two labels itself), so de shows whether ours are in.
    await i18n.changeLanguage('de');
    // What extensions/default/src/getPanelModule.tsx does while registering.
    const panelLabels = () => [i18n.t('SidePanel:Studies'), i18n.t('SidePanel:Measurements')];
    expect(panelLabels()).not.toEqual(['Studien', 'Messungen']);

    require('./index'); // import only: no preRegistration

    expect(panelLabels()).toEqual(['Studien', 'Messungen']);
    await i18n.changeLanguage('fr');
    expect(panelLabels()).toEqual(['Études', 'Mesures']);
  });
});
