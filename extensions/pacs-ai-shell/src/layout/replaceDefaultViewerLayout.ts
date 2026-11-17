/**
 * Until our own mode exists (P2.6, modes/pacs-ai), the stock modes still name
 * the default extension's layout template
 * (`@ohif/extension-default.layoutTemplateModule.viewerLayout`) and their
 * files stay as upstream ships them. So that those modes render the PACS-AI
 * layout, the module entry that ExtensionManager.getModuleEntry returns for
 * that id is pointed at our component. Mode.tsx reads `.component` from that
 * entry each time it renders a layout.
 *
 * Remove this when modes/pacs-ai points its layoutTemplate at
 * `@pacs-ai/extension-shell.layoutTemplateModule.viewerLayout`.
 */
export const DEFAULT_VIEWER_LAYOUT_ID = '@ohif/extension-default.layoutTemplateModule.viewerLayout';

export function replaceDefaultViewerLayout(extensionManager, layoutComponent): boolean {
  const entry = extensionManager.getModuleEntry(DEFAULT_VIEWER_LAYOUT_ID);
  if (!entry) {
    console.warn(`PACS-AI: ${DEFAULT_VIEWER_LAYOUT_ID} is not registered; stock modes keep their layout.`);
    return false;
  }
  entry.component = layoutComponent;
  return true;
}
