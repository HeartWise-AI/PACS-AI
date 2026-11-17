import PacsAiSeriesListPanel from './PacsAiSeriesListPanel';
import PacsAiTrackedSeriesListPanel from './PacsAiTrackedSeriesListPanel';

/**
 * Until our own mode exists (P2.6, modes/pacs-ai), the stock modes name
 * OHIF's study browser panels for their left panel and their files stay as
 * upstream ships them. So that those modes show the PACS-AI study browser,
 * the module entries ExtensionManager.getModuleEntry returns for these ids
 * get our component; the entry's id, name, icon and label stay as they are.
 *
 * The measurement-tracking extension is registered only when a mode that
 * uses it loads (after our preRegistration), so the swap is made when an
 * entry is looked up (PanelService resolves left panels that way), not once
 * at registration.
 *
 * Remove this when modes/pacs-ai names
 * `@pacs-ai/extension-inference.panelModule.seriesList` /
 * `.trackedSeriesList` directly.
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
