import { DEFAULT_VIEWER_LAYOUT_ID, replaceDefaultViewerLayout } from './replaceDefaultViewerLayout';

describe('replaceDefaultViewerLayout', () => {
  test('points the default layout entry at our component', () => {
    const DefaultLayout = () => null;
    const OurLayout = () => null;
    const entry = { id: DEFAULT_VIEWER_LAYOUT_ID, component: DefaultLayout };
    const extensionManager = { getModuleEntry: jest.fn(() => entry) };

    expect(replaceDefaultViewerLayout(extensionManager, OurLayout)).toBe(true);
    expect(extensionManager.getModuleEntry).toHaveBeenCalledWith(
      '@ohif/extension-default.layoutTemplateModule.viewerLayout'
    );
    expect(entry.component).toBe(OurLayout);
  });

  test('does nothing when the default layout is not registered', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const extensionManager = { getModuleEntry: jest.fn(() => undefined) };

    expect(replaceDefaultViewerLayout(extensionManager, () => null)).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('pluginConfig.json'));
    consoleError.mockRestore();
  });
});
