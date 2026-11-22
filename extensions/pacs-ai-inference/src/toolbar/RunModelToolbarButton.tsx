import React from 'react';
import { useSystem } from '@ohif/core';
import useAvailableModels from '@pacs-ai/extension-core/src/hooks/useAvailableModels';
import AIModelButton from '../AIModelButton';

/**
 * The run-model menu as a toolbar button: the same AIModelButton the viewer
 * header rendered directly before P2.4 (models from the models service, the
 * stored-results entries per model inside the menu). The toolbar's own props
 * (onInteraction, isOpen, ...) are not used.
 */
function RunModelToolbarButton() {
  const { servicesManager } = useSystem();
  const { inferenceAvailableModels, fetchingAvailableModels } = useAvailableModels();

  return (
    <AIModelButton
      isShowBG={true}
      servicesManager={servicesManager}
      inferenceAvailableModels={inferenceAvailableModels}
      loading={fetchingAvailableModels}
    />
  );
}

export default RunModelToolbarButton;
