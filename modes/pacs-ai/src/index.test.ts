const mockBaseEnter = jest.fn();
const mockBaseExit = jest.fn();
const baseLayout = {
  id: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  props: {
    leftPanels: ['@ohif/extension-measurement-tracking.panelModule.seriesList'],
    leftPanelResizable: true,
    rightPanels: [
      '@ohif/extension-cornerstone.panelModule.panelSegmentation',
      '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
    ],
    rightPanelClosed: true,
    rightPanelResizable: true,
    viewports: [{ namespace: 'tracked-viewport', displaySetsToDisplay: ['stack'] }],
  },
};

// The longitudinal mode as @ohif/mode-longitudinal exports it (shape only).
jest.mock(
  '@ohif/mode-longitudinal',
  () => ({
    __esModule: true,
    default: {
      id: '@ohif/mode-longitudinal',
      extensionDependencies: { '@ohif/extension-default': '^3.0.0' },
      modeFactory: () => ({
        id: '@ohif/mode-longitudinal',
        routeName: 'viewer',
        displayName: 'Basic Viewer',
        onModeEnter: (...args) => mockBaseEnter(...args),
        onModeExit: (...args) => mockBaseExit(...args),
        validationTags: { study: [], series: [] },
        isValidMode: () => ({ valid: true }),
        routes: [{ path: 'longitudinal', layoutTemplate: () => baseLayout }],
        extensions: {
          '@ohif/extension-default': '^3.0.0',
          '@ohif/extension-measurement-tracking': '^3.0.0',
        },
        hangingProtocol: 'default',
        sopClassHandlers: ['video', 'stack', 'sr'],
      }),
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

import mode, { ROUTE_NAME, extensionDependencies } from './index';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const create = (modeConfiguration = {}) => mode.modeFactory({ modeConfiguration } as any) as any;

describe('@pacs-ai/mode-viewer', () => {
  beforeEach(() => jest.clearAllMocks());

  test('serves /viewer under its own id', () => {
    const viewerMode = create();
    expect(mode.id).toBe('@pacs-ai/mode-viewer');
    expect(viewerMode.id).toBe('@pacs-ai/mode-viewer');
    expect(viewerMode.routeName).toBe('viewer');
    expect(ROUTE_NAME).toBe('viewer');
  });

  test('names the PACS-AI layout and study browser, keeping the rest of the longitudinal layout', () => {
    const layout = create().routes[0].layoutTemplate({});
    expect(layout.id).toBe('@pacs-ai/extension-shell.layoutTemplateModule.viewerLayout');
    expect(layout.props.leftPanels).toEqual([
      '@pacs-ai/extension-inference.panelModule.trackedSeriesList',
    ]);
    expect(layout.props.rightPanels).toEqual(baseLayout.props.rightPanels);
    expect(layout.props.rightPanelClosed).toBe(true);
    expect(layout.props.viewports).toBe(baseLayout.props.viewports);
    // The stock layout definition is not changed.
    expect(baseLayout.props.leftPanels).toEqual([
      '@ohif/extension-measurement-tracking.panelModule.seriesList',
    ]);
  });

  test('keeps the SOP class handlers, hanging protocol and validity check of the longitudinal mode', () => {
    const viewerMode = create();
    expect(viewerMode.sopClassHandlers).toEqual(['video', 'stack', 'sr']);
    expect(viewerMode.hangingProtocol).toBe('default');
    expect(viewerMode.isValidMode({ modalities: 'XA' })).toEqual({ valid: true });
  });

  test('depends on the longitudinal extensions and the PACS-AI ones', () => {
    const viewerMode = create();
    expect(Object.keys(viewerMode.extensions)).toEqual(
      expect.arrayContaining([
        '@ohif/extension-default',
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

  test('onModeEnter sets up the longitudinal toolbar, then the PACS-AI toolbar and behaviour', () => {
    const toolbarService = { name: 'toolbarService' };
    const servicesManager = { services: { toolbarService } };
    const args = { servicesManager };

    create().onModeEnter(args);

    expect(mockBaseEnter).toHaveBeenCalledWith(args);
    expect(mockAddViewerHeaderButtons).toHaveBeenCalledWith(toolbarService);
    expect(mockRegisterChatButton).toHaveBeenCalledWith(toolbarService);
    expect(mockAddCurrentSeriesLabel).toHaveBeenCalledWith(toolbarService);
    expect(mockEnterBehaviour).toHaveBeenCalledWith(servicesManager);
    expect(mockBaseEnter.mock.invocationCallOrder[0]).toBeLessThan(
      mockAddViewerHeaderButtons.mock.invocationCallOrder[0]
    );
  });

  test('onModeExit stops the PACS-AI behaviour and runs the longitudinal exit', () => {
    const servicesManager = { services: {} };
    create().onModeExit({ servicesManager });
    expect(mockExitBehaviour).toHaveBeenCalledWith(servicesManager);
    expect(mockBaseExit).toHaveBeenCalledWith({ servicesManager });
  });

  test('applies the app config modesConfiguration last', () => {
    expect(create({ displayName: 'Configured' }).displayName).toBe('Configured');
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
