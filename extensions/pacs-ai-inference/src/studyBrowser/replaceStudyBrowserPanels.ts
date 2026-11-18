import PacsAiSeriesListPanel from './PacsAiSeriesListPanel';
import PacsAiTrackedSeriesListPanel from './PacsAiTrackedSeriesListPanel';

/**
 * The stock OHIF modes still registered in platform/app/pluginConfig.json
 * name OHIF's study browser panels for their left panel and their files stay
 * as upstream ships them: segmentation (offered by the PACS-AI work list),
 * tmtv, microscopy and preclinical-4d use the default extension's
 * `seriesList`, ultrasound annotation the measurement-tracking one. So that
 * those modes keep showing the PACS-AI study browser, as before
 * modes/pacs-ai existed, the module entries ExtensionManager.getModuleEntry
 * returns for these ids get our component; the entry's id, name, icon and
 * label stay as they are.
 *
 * The measurement-tracking extension is registered only when a mode that
 * uses it loads (after our preRegistration), so the swap is made when an
 * entry is looked up (PanelService resolves left panels that way), not once
 * at registration.
 *
 * modes/pacs-ai (`/viewer`) names
 * `@pacs-ai/extension-inference.panelModule.trackedSeriesList` directly and
 * does not depend on this. Remove it when the stock modes are retired or get
 * PACS-AI variants.
 */
export const STUDY_BROWSER_PANEL_REPLACEMENTS = {
  '@ohif/extension-default.panelModule.seriesList': PacsAiSeriesListPanel,
  '@ohif/extension-measurement-tracking.panelModule.seriesList': PacsAiTrackedSeriesListPanel,
};

const REPLACED = Symbol.for('pacsAi.studyBrowserPanelsReplaced');

export function replaceStudyBrowserPanels(
  extensionManager,
  replacements: Record<string, unknown> = STUDY_BROWSER_PANEL_REPLACEMENTS
): void {
  if (!extensionManager || extensionManager[REPLACED]) {
    return;
  }
  const getModuleEntry = extensionManager.getModuleEntry.bind(extensionManager);
  extensionManager.getModuleEntry = (id: string) => {
    const entry = getModuleEntry(id);
    const replacement = replacements[id];
    if (entry && replacement && entry.component !== replacement) {
      entry.component = replacement;
    }
    return entry;
  };
  extensionManager[REPLACED] = true;
}
