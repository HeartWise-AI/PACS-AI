import React from 'react';
import PacsAiViewerLayout from './PacsAiViewerLayout';
import PacsAiErrorBoundary from '../components/PacsAiErrorBoundary';

export const VIEWER_LAYOUT_NAME = 'viewerLayout';

/**
 * Layout template module: `@pacs-ai/extension-shell.layoutTemplateModule.viewerLayout`.
 * Same calling convention as @ohif/extension-default's getLayoutTemplateModule,
 * except that the layout is rendered as an element inside our error boundary
 * (default's calls ViewerLayout as a function, which would put the layout's
 * own render and hooks outside any boundary but OHIF's route boundary, which
 * shows the red notification).
 */
export default function getLayoutTemplateModule({
  servicesManager,
  extensionManager,
  commandsManager,
  hotkeysManager,
}) {
  function PacsAiViewerLayoutWithServices(props) {
    return (
      <PacsAiErrorBoundary context="Viewer layout">
        <PacsAiViewerLayout
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          commandsManager={commandsManager}
          hotkeysManager={hotkeysManager}
          {...props}
        />
      </PacsAiErrorBoundary>
    );
  }

  return [
    {
      name: VIEWER_LAYOUT_NAME,
      id: VIEWER_LAYOUT_NAME,
      component: PacsAiViewerLayoutWithServices,
    },
  ];
}
