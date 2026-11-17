import { id } from './id';
import getPanelModule from './studyBrowser/getPanelModule';
import { replaceStudyBrowserPanels } from './studyBrowser/replaceStudyBrowserPanels';
import getToolbarModule, { addViewerHeaderButtons } from './toolbar/getToolbarModule';

export {
  ViewerModelResultsProvider,
  useViewerModelResults,
} from './viewerResults/ViewerModelResultsProvider';
export { default as InferenceNotificationsBell } from './InferenceNotificationsBell';
export { default as AIModelButton } from './AIModelButton';
export {
  RUN_MODEL_BUTTON_ID,
  RUN_MODEL_UI_TYPE,
  VIEWER_HEADER_SECTION,
} from './toolbar/getToolbarModule';

/**
 * PACS-AI inference extension (docs/ohif-upgrade/PLAN.md 6.1, F5–F7, F18–F22):
 * running a model from the viewer (run-model menu as a toolbar button),
 * stored results (drawer, ready notice, selected-view badges), the running
 * jobs card, study processing status and notifications, refresh from PACS,
 * and the study browser panel that shows them.
 *
 * Registered in platform/app/pluginConfig.json after @ohif/extension-default.
 * Until modes/pacs-ai exists (P2.6) the stock modes' study browser panels
 * render ours (see replaceStudyBrowserPanels) and the button is added to the
 * PACS-AI viewer header's toolbar section on every mode entry.
 */
const pacsAiInferenceExtension = {
  id,

  preRegistration({ extensionManager }) {
    replaceStudyBrowserPanels(extensionManager);
  },

  onModeEnter({ servicesManager }) {
    addViewerHeaderButtons(servicesManager?.services?.toolbarService);
  },

  getPanelModule,
  getToolbarModule,
};

export default pacsAiInferenceExtension;
