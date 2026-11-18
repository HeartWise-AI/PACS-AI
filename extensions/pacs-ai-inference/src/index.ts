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
  addViewerHeaderButtons,
} from './toolbar/getToolbarModule';

/** Panel ids a mode names for the PACS-AI study browser (see getPanelModule). */
export const STUDY_BROWSER_PANEL_ID = `${id}.panelModule.seriesList`;
export const TRACKED_STUDY_BROWSER_PANEL_ID = `${id}.panelModule.trackedSeriesList`;

/**
 * PACS-AI inference extension (docs/ohif-upgrade/PLAN.md 6.1, F5–F7, F18–F22):
 * running a model from the viewer (run-model menu as a toolbar button),
 * stored results (drawer, ready notice, selected-view badges), the running
 * jobs card, study processing status and notifications, refresh from PACS,
 * and the study browser panel that shows them.
 *
 * Registered in platform/app/pluginConfig.json after @ohif/extension-default.
 * modes/pacs-ai names our study browser panel and places the run-model button
 * itself. The stock modes still registered (`/segmentation` and the other
 * stock routes) keep our study browser through replaceStudyBrowserPanels and
 * get the button from this extension's onModeEnter, as before P2.6.
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
