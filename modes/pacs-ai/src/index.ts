import longitudinalMode from '@ohif/mode-longitudinal';
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

/** The PACS-AI extensions the mode uses, on top of the longitudinal mode's. */
const pacsAiExtensionDependencies = {
  '@pacs-ai/extension-shell': '^1.0.0',
  '@pacs-ai/extension-inference': '^1.0.0',
  '@pacs-ai/extension-chat': '^1.0.0',
};

export const extensionDependencies = {
  ...longitudinalMode.extensionDependencies,
  ...pacsAiExtensionDependencies,
};

/**
 * The PACS-AI viewer mode (docs/ohif-upgrade/PLAN.md 6.1, F5–F9, F15).
 *
 * Built from OHIF's longitudinal mode, which served `/viewer` before
 * (phase 2, on OHIF 3.11.1; phase 3 builds it on @ohif/mode-basic): the same
 * route name, SOP class handlers, viewports, hanging protocol, right panels,
 * tool groups and primary toolbar. On top of it:
 *
 * - layout: the PACS-AI viewer layout (@pacs-ai/extension-shell);
 * - left panel: the PACS-AI study browser (@pacs-ai/extension-inference,
 *   the measurement-tracking variant that longitudinal uses);
 * - toolbar: the run-model menu (`pacsAiViewerHeader`), the chat button
 *   (`pacsAiChat`) and "Series: <current series>" in each viewport's action
 *   bar;
 * - viewer behaviour: arrow keys change the series and page keys the image,
 *   cine autoplay for US and XA at the series' Cine Rate, the PACS-AI cine
 *   player.
 */
function modeFactory({ modeConfiguration = {}, loadModules = undefined } = {} as any) {
  const base = longitudinalMode.modeFactory({ modeConfiguration: {}, loadModules } as any);
  const [baseRoute] = base.routes;

  return {
    ...base,
    id,
    routeName: ROUTE_NAME,
    displayName: 'PACS-AI Viewer',

    onModeEnter(args) {
      base.onModeEnter(args);

      const { toolbarService } = args.servicesManager.services;
      addViewerHeaderButtons(toolbarService);
      registerChatButton(toolbarService);
      addCurrentSeriesLabel(toolbarService);
      enterPacsAiViewerBehaviour(args.servicesManager);
    },

    onModeExit(args) {
      exitPacsAiViewerBehaviour(args.servicesManager);
      base.onModeExit(args);
    },

    routes: [
      {
        ...baseRoute,
        path: 'pacs-ai',
        layoutTemplate: (...layoutArgs) => {
          const layout = baseRoute.layoutTemplate(...layoutArgs);
          return {
            ...layout,
            id: PACS_AI_VIEWER_LAYOUT_ID,
            props: {
              ...layout.props,
              leftPanels: [TRACKED_STUDY_BROWSER_PANEL_ID],
            },
          };
        },
      },
    ],

    extensions: {
      ...base.extensions,
      ...pacsAiExtensionDependencies,
    },

    ...modeConfiguration,
  };
}

const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;
