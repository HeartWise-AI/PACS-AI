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
    // @ohif/extension-default must be listed before @pacs-ai/extension-shell
    // in platform/app/pluginConfig.json (index.test.ts checks it).
    console.error(
      `PACS-AI: ${DEFAULT_VIEWER_LAYOUT_ID} is not registered when @pacs-ai/extension-shell registers; ` +
        'the viewer will show the stock OHIF layout without the PACS-AI header, run-model menu, chat and results. ' +
        'Register @ohif/extension-default before @pacs-ai/extension-shell in pluginConfig.json.'
    );
    return false;
  }
  entry.component = layoutComponent;
  return true;
}
