import {
  basicLayout,
  basicRoute,
  cornerstone,
  customizations as basicCustomizations,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';
import {
  PACS_AI_VIEWER_LAYOUT_ID,
  addCurrentSeriesLabel,
  enterPacsAiViewerBehaviour,
  exitPacsAiViewerBehaviour,
} from '@pacs-ai/extension-shell';
import {
  TRACKED_STUDY_BROWSER_PANEL_ID,
  addViewerHeaderButtons,
} from '@pacs-ai/extension-inference';
import { registerChatButton } from '@pacs-ai/extension-chat';
import { id } from './id';

/** URL segment of the mode: `/viewer?StudyInstanceUIDs=...`, as with OHIF's basic viewer. */
export const ROUTE_NAME = 'viewer';

/**
 * The measurement-tracking pieces OHIF's longitudinal mode adds to the basic
 * mode (modes/longitudinal), which served `/viewer` before this mode: the
 * tracked measurements panel and the tracked cornerstone viewport.
 */
export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
};

/** The PACS-AI extensions the mode uses, on top of the basic mode's. */
const pacsAiExtensionDependencies = {
  '@pacs-ai/extension-shell': '^1.0.0',
  '@pacs-ai/extension-inference': '^1.0.0',
  '@pacs-ai/extension-chat': '^1.0.0',
};

export const extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
  ...pacsAiExtensionDependencies,
};

/**
 * The layout: the basic layout with the PACS-AI layout template, the PACS-AI
 * study browser (measurement-tracking variant) on the left, and the
 * longitudinal mode's right panels and tracked viewport.
 */
export const pacsAiLayout = {
  ...basicLayout,
  id: PACS_AI_VIEWER_LAYOUT_ID,
  props: {
    ...basicLayout.props,
    leftPanels: [TRACKED_STUDY_BROWSER_PANEL_ID],
    rightPanels: [cornerstone.segmentation, tracked.measurements],
    viewports: [
      {
        namespace: tracked.viewport,
        displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
      },
      ...basicLayout.props.viewports,
    ],
  },
};

export const pacsAiRoute = {
  ...basicRoute,
  path: 'pacs-ai',
  layoutInstance: pacsAiLayout,
};

/**
 * Mode enter: the basic mode's (tool groups, then the toolbar seeded from the
 * `toolbarButtons`/`toolbarSections` customizations), then the PACS-AI
 * toolbar entries, which therefore land after that seeding, and the viewer
 * behaviour. Called with the mode instance as `this`, as Mode.tsx does.
 */
function onModeEnter(this: any, args) {
  basicModeInstance.onModeEnter.call(this, args);

  const { toolbarService } = args.servicesManager.services;
  addViewerHeaderButtons(toolbarService);
  registerChatButton(toolbarService);
  addCurrentSeriesLabel(toolbarService);
  enterPacsAiViewerBehaviour(args.servicesManager);
}

function onModeExit(this: any, args) {
  exitPacsAiViewerBehaviour(args.servicesManager);
  basicModeInstance.onModeExit.call(this, args);
}

/**
 * The PACS-AI viewer mode instance (docs/ohif-upgrade/PLAN.md 6.1, F5–F9,
 * F15), built on OHIF's basic mode (@ohif/mode-basic) the way OHIF's
 * longitudinal mode is: same SOP class handlers, hanging protocol, tool
 * groups, toolbar composition (`cornerstone.toolbarButtons`/`toolbarSections`)
 * and mode customizations (`basicModeCustomizations`). On top of it:
 *
 * - layout: the PACS-AI viewer layout (@pacs-ai/extension-shell);
 * - left panel: the PACS-AI study browser (@pacs-ai/extension-inference);
 * - right panels and viewport: the longitudinal mode's measurement tracking;
 * - toolbar: the run-model menu (`pacsAiViewerHeader`), the chat button
 *   (`pacsAiChat`) and "Series: <current series>" in each viewport's action
 *   bar;
 * - viewer behaviour: arrow keys change the series and page keys the image,
 *   cine autoplay for US and XA at the series' Cine Rate, the PACS-AI cine
 *   player.
 */
export const modeInstance = {
  ...basicModeInstance,
  id,
  routeName: ROUTE_NAME,
  displayName: 'PACS-AI Viewer',
  hide: false,
  routes: [pacsAiRoute],
  extensions: extensionDependencies,
  onModeEnter,
  onModeExit,
};

/**
 * The basic mode's customizations (registered at default scope when the mode
 * loads). `modeInstance.modeCustomizations` names `basicModeCustomizations`
 * from it (segmentation panel editing off, as in OHIF's own `/viewer`); it is
 * exported here too, so that it is registered even if @ohif/mode-basic is
 * removed from the app's modes.
 */
export const customizations = { ...basicCustomizations };

/**
 * The mode: `modeFactory` (the basic mode's) applies the app config's
 * `modesConfiguration[id]` to `modeInstance` with immutability-helper commands
 * (`{ displayName: { $set: '...' } }`).
 */
const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
  customizations,
};

export default mode;
