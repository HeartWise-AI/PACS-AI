jest.mock('react-dates/initialize', () => ({}), { virtual: true });
jest.mock('react-dates/lib/css/_datepicker.css', () => ({}), { virtual: true });
jest.mock('./routes/pacsAiRoutes', () => ({
  getPacsAiRoutes: () => [{ path: '/', children: () => null, private: true }],
}));
jest.mock('./providers/PacsAiShellProviders', () => function MockShellProviders() {
  return null;
});
jest.mock('./layout/PacsAiViewerLayout', () => jest.fn(() => null));
jest.mock('@ohif/ui-next', () => ({ ErrorBoundary: () => null }));
jest.mock('./errors/routeErrorNotifications', () => ({
  stopRouteErrorNotifications: jest.fn(),
}));

import pacsAiShellExtension, { PACS_AI_SHELL_PROVIDER, turnOffOhifStudyList } from './index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import PacsAiViewerLayout from './layout/PacsAiViewerLayout';
import { stopRouteErrorNotifications } from './errors/routeErrorNotifications';

describe('@pacs-ai/extension-shell', () => {
  test('registers our routes as the routes.customRoutes customization', () => {
    const [module] = (pacsAiShellExtension.getCustomizationModule as any)();
    expect(module.name).toBe('global');
    const customRoutes = module.value['routes.customRoutes'];
    expect(customRoutes.routes.map(route => route.path)).toEqual(['/']);
    expect(customRoutes.notFoundRoute).toBeNull();
  });

  test('preRegistration mounts the shell providers and gives stock modes our layout', () => {
    const defaultEntry = { component: () => null };
    const managers = {
      servicesManager: { services: {} },
      serviceProvidersManager: { registerProvider: jest.fn() },
      extensionManager: { getModuleEntry: jest.fn(() => defaultEntry) },
      commandsManager: {},
      hotkeysManager: {},
    };

    (pacsAiShellExtension.preRegistration as any)(managers);

    expect(stopRouteErrorNotifications).toHaveBeenCalled();
    expect(managers.serviceProvidersManager.registerProvider).toHaveBeenCalledWith(
      PACS_AI_SHELL_PROVIDER,
      expect.any(Function)
    );

    const element = (defaultEntry.component as any)({ viewports: [] });
    expect(element.props.context).toBe('Viewer layout');
    expect(element.props.children.type).toBe(PacsAiViewerLayout);
    expect(element.props.children.props).toEqual(
      expect.objectContaining({
        servicesManager: managers.servicesManager,
        extensionManager: managers.extensionManager,
        viewports: [],
      })
    );
  });

  test('provides the layout template module under the default layout name', () => {
    const [layout] = (pacsAiShellExtension.getLayoutTemplateModule as any)({});
    expect(layout.name).toBe('viewerLayout');
    expect(typeof layout.component).toBe('function');
  });

  test('preRegistration turns off OHIF\'s own study list so that `/` is ours', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const appConfig = { showStudyList: true };
    (pacsAiShellExtension.preRegistration as any)({
      servicesManager: { services: {} },
      serviceProvidersManager: { registerProvider: jest.fn() },
      extensionManager: { getModuleEntry: jest.fn(() => ({ component: null })) },
      appConfig,
    });
    expect(appConfig.showStudyList).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('showStudyList'));

    warn.mockClear();
    const unset: { showStudyList?: boolean } = {};
    turnOffOhifStudyList(unset);
    expect(unset.showStudyList).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('pluginConfig registers the default extension and core before the shell', () => {
    const pluginConfig = JSON.parse(
      readFileSync(resolve(__dirname, '../../../platform/app/pluginConfig.json'), 'utf8')
    );
    const order = pluginConfig.extensions.map(extension => extension.packageName);
    const shell = order.indexOf('@pacs-ai/extension-shell');
    expect(shell).toBeGreaterThan(-1);
    // Its layout template is replaced in our preRegistration.
    expect(order.indexOf('@ohif/extension-default')).toBeGreaterThan(-1);
    expect(order.indexOf('@ohif/extension-default')).toBeLessThan(shell);
    // Core's providers must wrap ours.
    expect(order.indexOf('@pacs-ai/extension-core')).toBeGreaterThan(-1);
    expect(order.indexOf('@pacs-ai/extension-core')).toBeLessThan(shell);
  });
});
