import { readFileSync } from 'fs';
import { resolve } from 'path';

jest.mock('./studyBrowser/getPanelModule', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('./studyBrowser/replaceStudyBrowserPanels', () => ({
  replaceStudyBrowserPanels: jest.fn(),
}));
jest.mock('./toolbar/getToolbarModule', () => ({
  __esModule: true,
  default: jest.fn(),
  addViewerHeaderButtons: jest.fn(),
}));
jest.mock('./viewerResults/ViewerModelResultsProvider', () => ({}));
jest.mock('./InferenceNotificationsBell', () => ({ __esModule: true, default: () => null }));
jest.mock('./AIModelButton', () => ({ __esModule: true, default: () => null }));

import extension from './index';
import { replaceStudyBrowserPanels } from './studyBrowser/replaceStudyBrowserPanels';
import { addViewerHeaderButtons } from './toolbar/getToolbarModule';

describe('@pacs-ai/extension-inference', () => {
  it('swaps the study browser panels at registration', () => {
    const extensionManager = {};
    extension.preRegistration({ extensionManager } as any);
    expect(replaceStudyBrowserPanels).toHaveBeenCalledWith(extensionManager);
  });

  it('adds the header buttons on every mode entry', () => {
    const toolbarService = {};
    extension.onModeEnter({ servicesManager: { services: { toolbarService } } } as any);
    expect(addViewerHeaderButtons).toHaveBeenCalledWith(toolbarService);
  });

  it('is registered after the default extension and core, before the shell', () => {
    const pluginConfig = JSON.parse(
      readFileSync(resolve(__dirname, '../../../platform/app/pluginConfig.json'), 'utf8')
    );
    const order = pluginConfig.extensions.map(entry => entry.packageName);
    const inference = order.indexOf('@pacs-ai/extension-inference');

    expect(inference).toBeGreaterThan(order.indexOf('@ohif/extension-default'));
    expect(inference).toBeGreaterThan(order.indexOf('@pacs-ai/extension-core'));
    expect(inference).toBeLessThan(order.indexOf('@pacs-ai/extension-shell'));
    expect(pluginConfig.extensions[inference].default).not.toBe(false);
  });
});
