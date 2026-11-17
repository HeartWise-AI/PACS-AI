import PacsAiViewerLayout from './PacsAiViewerLayout';

export const VIEWER_LAYOUT_NAME = 'viewerLayout';

/**
 * Layout template module: `@pacs-ai/extension-shell.layoutTemplateModule.viewerLayout`.
 * Same calling convention as @ohif/extension-default's getLayoutTemplateModule.
 */
export default function getLayoutTemplateModule({
  servicesManager,
  extensionManager,
  commandsManager,
  hotkeysManager,
}) {
  function PacsAiViewerLayoutWithServices(props) {
    return PacsAiViewerLayout({
      servicesManager,
      extensionManager,
      commandsManager,
      hotkeysManager,
      ...props,
    });
  }

  return [
    {
      name: VIEWER_LAYOUT_NAME,
      id: VIEWER_LAYOUT_NAME,
      component: PacsAiViewerLayoutWithServices,
    },
  ];
}
