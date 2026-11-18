/**
 * The stock modes' study browser panel ids resolve to our components through
 * the real ExtensionManager and PanelService, including the measurement
 * tracking extension that registers after us (when its mode loads).
 */
// OHIF's own classes, from @ohif/core's sources (the package entry is its
// build output, absent in unit tests).
import ExtensionManager from '@ohif/core/src/extensions/ExtensionManager';
import PanelService from '@ohif/core/src/services/PanelService/PanelService';
import inferenceExtension from '../index';
import PacsAiSeriesListPanel from './PacsAiSeriesListPanel';
import PacsAiTrackedSeriesListPanel from './PacsAiTrackedSeriesListPanel';

// Parts of the extension not under test.
jest.mock('../toolbar/getToolbarModule', () => ({
  __esModule: true,
  default: () => [],
  addViewerHeaderButtons: jest.fn(),
}));
jest.mock('../AIModelButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../InferenceNotificationsBell', () => ({ __esModule: true, default: () => null }));
jest.mock('../viewerResults/ViewerModelResultsProvider', () => ({}));
// Module-level needs of our panel components (they are not rendered here).
jest.mock('@ohif/core', () => ({ utils: {}, useSystem: jest.fn() }), { virtual: true });
jest.mock('@ohif/ui-next', () => ({ Icons: {} }), { virtual: true });
jest.mock(
  '@ohif/extension-default',
  () => ({
    MoreDropdownMenu: () => () => null,
    getStudiesForPatientByMRN: jest.fn(),
    requestDisplaySetCreationForStudy: jest.fn(),
  }),
  { virtual: true }
);

const UpstreamDefaultPanel = () => null;
const UpstreamTrackedPanel = () => null;

function stockExtension(id: string, component) {
  return {
    id,
    getPanelModule: () => [
      {
        name: 'seriesList',
        iconName: 'tab-studies',
        iconLabel: 'Studies',
        label: 'Studies',
        component,
      },
    ],
  };
}

describe('study browser panels with the real ExtensionManager and PanelService', () => {
  it('resolves the default and tracked seriesList ids to the PACS-AI panels', async () => {
    const commandsManager = {
      createContext: jest.fn(),
      getContext: jest.fn(),
      registerCommand: jest.fn(),
    };
    const servicesManager = { registerService: jest.fn(), services: {} };
    const extensionManager = new ExtensionManager({
      commandsManager,
      servicesManager,
      appConfig: {},
    } as any);
    const panelService = new PanelService(extensionManager);

    // App start: default extension first, then ours (pluginConfig order).
    await extensionManager.registerExtension(
      stockExtension('@ohif/extension-default', UpstreamDefaultPanel) as any
    );
    await extensionManager.registerExtension(inferenceExtension as any);
    // Mode load: measurement tracking registers after us.
    await extensionManager.registerExtension(
      stockExtension('@ohif/extension-measurement-tracking', UpstreamTrackedPanel) as any
    );

    const defaultPanel = panelService.getPanelData(
      '@ohif/extension-default.panelModule.seriesList'
    );
    const trackedPanel = panelService.getPanelData(
      '@ohif/extension-measurement-tracking.panelModule.seriesList'
    );

    expect(defaultPanel.content).toBe(PacsAiSeriesListPanel);
    expect(trackedPanel.content).toBe(PacsAiTrackedSeriesListPanel);
    // The entry keeps OHIF's id, name and label.
    expect(trackedPanel).toMatchObject({
      id: '@ohif/extension-measurement-tracking.panelModule.seriesList',
      name: 'seriesList',
      label: 'Studies',
    });
    // Our own panel module is registered too (modes/pacs-ai names it).
    expect(
      (
        extensionManager.getModuleEntry(
          '@pacs-ai/extension-inference.panelModule.trackedSeriesList'
        ) as { component?: unknown } | undefined
      )?.component
    ).toBe(PacsAiTrackedSeriesListPanel);
  });
});
