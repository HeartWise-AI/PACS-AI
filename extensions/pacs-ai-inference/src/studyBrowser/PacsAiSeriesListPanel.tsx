import React from 'react';
import PacsAiPanelStudyBrowser from './PacsAiPanelStudyBrowser';
import { usePanelStudyBrowserProps } from './usePanelStudyBrowserProps';

/**
 * The PACS-AI study browser in place of `@ohif/extension-default`'s
 * seriesList panel (its WrappedPanelStudyBrowser).
 */
function PacsAiSeriesListPanel() {
  const props = usePanelStudyBrowserProps();
  return <PacsAiPanelStudyBrowser {...props} />;
}

export default PacsAiSeriesListPanel;
