// OHIF's basic mode as it ships (its package `main` is a build output jest
// cannot load, so the source is used). Its one @ohif/core import is
// structuredCloneWithFunctions.
jest.mock('@ohif/mode-basic', () => jest.requireActual('@ohif/mode-basic/src/index.tsx'), {
  virtual: true,
});
jest.mock(
  '@ohif/core',
  () => ({
    utils: {
      structuredCloneWithFunctions: jest.requireActual(
        '@ohif/core/src/utils/structuredCloneWithFunctions'
      ).structuredCloneWithFunctions,
    },
  }),
  { virtual: true }
);

const mockAddCurrentSeriesLabel = jest.fn();
const mockEnterBehaviour = jest.fn();
const mockExitBehaviour = jest.fn();
jest.mock('@pacs-ai/extension-shell', () => ({
  PACS_AI_VIEWER_LAYOUT_ID: '@pacs-ai/extension-shell.layoutTemplateModule.viewerLayout',
  addCurrentSeriesLabel: (...args) => mockAddCurrentSeriesLabel(...args),
  enterPacsAiViewerBehaviour: (...args) => mockEnterBehaviour(...args),
  exitPacsAiViewerBehaviour: (...args) => mockExitBehaviour(...args),
}));
const mockAddViewerHeaderButtons = jest.fn();
jest.mock('@pacs-ai/extension-inference', () => ({
  TRACKED_STUDY_BROWSER_PANEL_ID: '@pacs-ai/extension-inference.panelModule.trackedSeriesList',
  addViewerHeaderButtons: (...args) => mockAddViewerHeaderButtons(...args),
}));
const mockRegisterChatButton = jest.fn();
jest.mock('@pacs-ai/extension-chat', () => ({
  registerChatButton: (...args) => mockRegisterChatButton(...args),
}));

import mode, { ROUTE_NAME, extensionDependencies, customizations } from './index';
import { basicLayout, modeInstance as basicModeInstance } from '@ohif/mode-basic';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// As appInit does: modeFactory called on the mode object.
const create = (modeConfiguration = {}) =>
  (mode.modeFactory as any)({ modeConfiguration } as any) as any;

const STOCK_LEFT_PANELS = ['@ohif/extension-default.panelModule.seriesList'];

describe('@pacs-ai/mode-viewer', () => {
  beforeEach(() => jest.clearAllMocks());

  test('serves /viewer under its own id', () => {
    const viewerMode = create();
    expect(mode.id).toBe('@pacs-ai/mode-viewer');
    expect(viewerMode.id).toBe('@pacs-ai/mode-viewer');
    expect(viewerMode.routeName).toBe('viewer');
    expect(ROUTE_NAME).toBe('viewer');
    expect(viewerMode.displayName).toBe('PACS-AI Viewer');
    expect(viewerMode.hide).toBe(false);
  });

  test('names the PACS-AI layout and study browser and the longitudinal right panels and tracked viewport', () => {
    const route = create().routes[0];
    // Mode.tsx calls route.layoutTemplate(...) as a method of the route.
    const layout = route.layoutTemplate({});
    expect(layout.id).toBe('@pacs-ai/extension-shell.layoutTemplateModule.viewerLayout');
    expect(layout.props.leftPanels).toEqual([
      '@pacs-ai/extension-inference.panelModule.trackedSeriesList',
    ]);
    expect(layout.props.rightPanels).toEqual([
      '@ohif/extension-cornerstone.panelModule.panelSegmentation',
      '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
    ]);
    expect(layout.props.rightPanelClosed).toBe(true);
    expect(layout.props.leftPanelResizable).toBe(true);
    expect(layout.props.viewports[0]).toEqual({
      namespace: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
      displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
    });
    expect(layout.props.viewports.slice(1)).toEqual(basicLayout.props.viewports);
    // Each call returns a copy; the stock layout definition is not changed.
    expect(route.layoutTemplate({})).not.toBe(layout);
    expect(basicLayout.props.leftPanels).toEqual(STOCK_LEFT_PANELS);
  });

  test('keeps the SOP class handlers, hanging protocol and validity check of the basic mode', () => {
    const viewerMode = create();
    expect(viewerMode.sopClassHandlers).toEqual(basicModeInstance.sopClassHandlers);
    expect(viewerMode.sopClassHandlers[0]).toBe(
      '@ohif/extension-dicom-video.sopClassHandlerModule.dicom-video'
    );
    expect(viewerMode.hangingProtocol).toBe('default');
    expect(viewerMode.isValidMode({ modalities: 'XA' }).valid).toBe(true);
    expect(viewerMode.isValidMode({ modalities: 'SR' }).valid).toBe(false);
  });

  test('depends on the basic and measurement-tracking extensions and the PACS-AI ones', () => {
    const viewerMode = create();
    expect(Object.keys(viewerMode.extensions)).toEqual(
      expect.arrayContaining([
        '@ohif/extension-default',
        '@ohif/extension-cornerstone',
        '@ohif/extension-measurement-tracking',
        '@pacs-ai/extension-shell',
        '@pacs-ai/extension-inference',
        '@pacs-ai/extension-chat',
      ])
    );
    expect(Object.keys(extensionDependencies)).toEqual(
      expect.arrayContaining(['@ohif/extension-default', '@pacs-ai/extension-shell'])
    );
  });

  test('exports the mode customizations its modeCustomizations names (segmentation editing off)', () => {
    const viewerMode = create();
    expect(viewerMode.modeCustomizations).toBe('basicModeCustomizations');
    expect(mode.customizations).toBe(customizations);
    expect(customizations.basicModeCustomizations).toEqual({
      'panelSegmentation.disableEditing': true,
    });
    // Toolbar composition comes from the cornerstone packs, as in OHIF's /viewer.
    expect(viewerMode.toolbarButtons).toEqual([{ $reference: 'cornerstone.toolbarButtons' }]);
    expect(viewerMode.toolbarSections).toEqual([{ $reference: 'cornerstone.toolbarSections' }]);
  });

  describe('onModeEnter', () => {
    const makeServices = () => {
      const calls: string[] = [];
      const toolbarService = {
        sections: { viewportActionMenu: { topMiddle: 'viewportActionMenu.topMiddle' } },
        register: jest.fn(() => calls.push('register')),
        updateSection: jest.fn(key => calls.push(`section:${key}`)),
      };
      const customizationService = {
        getCustomization: jest.fn(key =>
          key === 'toolbarSections'
            ? [{ primary: ['Zoom'] }]
            : key === 'toolbarButtons'
              ? []
              : undefined
        ),
      };
      const services = {
        measurementService: { clearMeasurements: jest.fn() },
        toolbarService,
        toolGroupService: {},
        customizationService,
        panelService: { addActivatePanelTriggers: jest.fn(() => []) },
      };
      return { calls, services, servicesManager: { services } };
    };

    test('sets up the basic mode (tool groups, seeded toolbar), then the PACS-AI toolbar and behaviour', () => {
      const initToolGroups = jest.fn();
      const viewerMode = create({ initToolGroups: { $set: initToolGroups } });
      const { calls, services, servicesManager } = makeServices();
      mockAddViewerHeaderButtons.mockImplementation(() => calls.push('pacsAiViewerHeader'));
      mockRegisterChatButton.mockImplementation(() => calls.push('pacsAiChat'));
      mockAddCurrentSeriesLabel.mockImplementation(() => calls.push('currentSeries'));
      const args = { servicesManager, extensionManager: {}, commandsManager: {} };

      // Mode.tsx calls mode.onModeEnter(...) as a method of the instance.
      viewerMode.onModeEnter(args);

      expect(initToolGroups).toHaveBeenCalledTimes(1);
      expect(services.measurementService.clearMeasurements).toHaveBeenCalled();
      expect(mockAddViewerHeaderButtons).toHaveBeenCalledWith(services.toolbarService);
      expect(mockRegisterChatButton).toHaveBeenCalledWith(services.toolbarService);
      expect(mockAddCurrentSeriesLabel).toHaveBeenCalledWith(services.toolbarService);
      expect(mockEnterBehaviour).toHaveBeenCalledWith(servicesManager);
      // The PACS-AI entries land after the basic mode's toolbar seeding.
      expect(calls).toEqual([
        'register',
        'section:primary',
        'pacsAiViewerHeader',
        'pacsAiChat',
        'currentSeries',
      ]);
      expect(viewerMode._unsubscriptions).toEqual([]);
    });

    test('onModeExit stops the PACS-AI behaviour and runs the basic exit', () => {
      const viewerMode = create();
      const unsubscribe = jest.fn();
      viewerMode._unsubscriptions = [unsubscribe];
      const services = {
        toolGroupService: { destroy: jest.fn() },
        syncGroupService: { destroy: jest.fn() },
        segmentationService: { destroy: jest.fn() },
        cornerstoneViewportService: { destroy: jest.fn() },
        uiDialogService: { hideAll: jest.fn() },
        uiModalService: { hide: jest.fn() },
      };
      const servicesManager = { services };
      viewerMode.onModeExit({ servicesManager });
      expect(mockExitBehaviour).toHaveBeenCalledWith(servicesManager);
      expect(unsubscribe).toHaveBeenCalled();
      expect(services.toolGroupService.destroy).toHaveBeenCalled();
      expect(services.cornerstoneViewportService.destroy).toHaveBeenCalled();
      expect(mockExitBehaviour.mock.invocationCallOrder[0]).toBeLessThan(
        services.toolGroupService.destroy.mock.invocationCallOrder[0]
      );
    });
  });

  test('applies the app config modesConfiguration (immutability-helper commands)', () => {
    expect(create({ displayName: { $set: 'Configured' } }).displayName).toBe('Configured');
    expect(create().displayName).toBe('PACS-AI Viewer');
  });

  test('is registered in pluginConfig in place of the longitudinal mode and first in pacs-ai.js', () => {
    const root = resolve(__dirname, '../../..');
    const pluginConfig = JSON.parse(
      readFileSync(resolve(root, 'platform/app/pluginConfig.json'), 'utf8')
    );
    const modes = pluginConfig.modes.map(entry => entry.packageName);
    expect(modes).toContain('@pacs-ai/mode-viewer');
    // Both would claim /viewer.
    expect(modes).not.toContain('@ohif/mode-longitudinal');
    // The segmentation mode stays offered by the work list.
    expect(modes).toContain('@ohif/mode-segmentation');

    const appConfig = readFileSync(resolve(root, 'pacs-ai/config/pacs-ai.js'), 'utf8');
    expect(appConfig).toMatch(/modes:\s*\[\s*'@pacs-ai\/mode-viewer'/);
  });
});
